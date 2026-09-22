import "@testing-library/jest-dom/vitest";

import type * as AuthModule from "@cdorneles/auth";
import { MantineProvider } from "@mantine/core";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { useAuthMock, invalidateMock, idleCallbacks, activateMock } = vi.hoisted(() => ({
  useAuthMock: vi.fn(),
  invalidateMock: vi.fn(),
  idleCallbacks: { current: {} as Record<string, () => void> },
  activateMock: vi.fn(),
}));

vi.mock("@cdorneles/auth", async () => {
  const actual = await vi.importActual<typeof AuthModule>("@cdorneles/auth");
  return { ...actual, useAuth: useAuthMock };
});
vi.mock("@tanstack/react-query", () => ({
  useQueryClient: () => ({ invalidateQueries: invalidateMock }),
}));
vi.mock("next/navigation", () => ({ usePathname: () => "/dashboard" }));
vi.mock("react-idle-timer", () => ({
  useIdleTimer: (options: Record<string, unknown>) => {
    idleCallbacks.current = options as Record<string, () => void>;
    return { activate: activateMock, getRemainingTime: () => 30_000 };
  },
}));

const { IdleLockGate, resolveIdleTimings } = await import("./idle-lock-gate");

function gateTree() {
  return (
    <MantineProvider>
      <div data-testid="page">rascunho do usuário</div>
      <IdleLockGate />
    </MantineProvider>
  );
}

function renderGate() {
  return render(gateTree());
}

describe("IdleLockGate", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useAuthMock.mockReturnValue({
      status: "authenticated",
      sessionState: "active",
      user: { id: "u1", email: "a@b.c", name: "A", emailVerified: true, mfaEnabled: false },
      reauthenticate: vi.fn().mockResolvedValue(undefined),
      completeReauthMfa: vi.fn(),
      logout: vi.fn(),
      service: { createMfaChallenge: vi.fn() },
    });
  });

  it("locks without unmounting the page", async () => {
    renderGate();

    idleCallbacks.current.onIdle();

    expect(await screen.findByText("Tela bloqueada")).toBeInTheDocument();
    // The page behind the overlay must survive the lock: unsaved work lives there.
    expect(screen.getByTestId("page")).toBeInTheDocument();
  });

  it("unlocks after the password is accepted", async () => {
    const reauthenticate = vi.fn().mockResolvedValue(undefined);
    useAuthMock.mockReturnValue({
      status: "authenticated",
      sessionState: "active",
      user: { id: "u1", email: "a@b.c", name: "A", emailVerified: true, mfaEnabled: false },
      reauthenticate,
      completeReauthMfa: vi.fn(),
      logout: vi.fn(),
      service: { createMfaChallenge: vi.fn() },
    });
    renderGate();

    idleCallbacks.current.onIdle();
    await screen.findByText("Tela bloqueada");

    await userEvent.type(screen.getByLabelText(/senha/i, { selector: "input" }), "segredo123");
    await userEvent.click(screen.getByRole("button", { name: /desbloquear/i }));

    await waitFor(() => expect(reauthenticate).toHaveBeenCalledWith({ email: "a@b.c", password: "segredo123" }));
    expect(invalidateMock).toHaveBeenCalled();
    await waitFor(() => expect(screen.queryByText("Tela bloqueada")).not.toBeInTheDocument());
  });

  it("resets the idle timer when the user continues", async () => {
    renderGate();

    idleCallbacks.current.onPrompt();
    await screen.findByText(/será bloqueada em/i);

    await userEvent.click(screen.getByRole("button", { name: /continuar trabalhando/i }));

    expect(activateMock).toHaveBeenCalledTimes(1);
  });

  it("does not re-lock after the session expires and is restored", async () => {
    const authed = {
      status: "authenticated",
      sessionState: "active",
      user: { id: "u1", email: "a@b.c", name: "A", emailVerified: true, mfaEnabled: false },
      reauthenticate: vi.fn(),
      completeReauthMfa: vi.fn(),
      logout: vi.fn(),
      service: { createMfaChallenge: vi.fn() },
    };
    useAuthMock.mockReturnValue(authed);
    const { rerender } = renderGate();

    idleCallbacks.current.onIdle();
    await screen.findByText("Tela bloqueada");

    // The session dies: the session-expired gate takes over, the lock yields.
    useAuthMock.mockReturnValue({ ...authed, sessionState: "expired" });
    rerender(gateTree());
    expect(screen.queryByText("Tela bloqueada")).not.toBeInTheDocument();

    // Reauthenticated: back to active, and the lock must NOT reappear.
    useAuthMock.mockReturnValue({ ...authed, sessionState: "active" });
    rerender(gateTree());
    expect(screen.queryByText("Tela bloqueada")).not.toBeInTheDocument();
  });

  it("does nothing while anonymous", () => {
    useAuthMock.mockReturnValue({
      status: "anonymous",
      sessionState: "active",
      user: null,
      reauthenticate: vi.fn(),
      completeReauthMfa: vi.fn(),
      logout: vi.fn(),
      service: { createMfaChallenge: vi.fn() },
    });
    renderGate();

    idleCallbacks.current.onIdle?.();

    expect(screen.queryByText("Tela bloqueada")).not.toBeInTheDocument();
  });
});

describe("resolveIdleTimings", () => {
  it("falls back to the defaults when unset", () => {
    expect(resolveIdleTimings(undefined, undefined)).toEqual({
      timeoutMs: 15 * 60 * 1000,
      promptBeforeIdleMs: 30 * 1000,
    });
  });

  it("parses minutes and seconds", () => {
    expect(resolveIdleTimings("5", "10")).toEqual({
      timeoutMs: 5 * 60 * 1000,
      promptBeforeIdleMs: 10 * 1000,
    });
  });

  it("ignores invalid values", () => {
    expect(resolveIdleTimings("nope", "-1")).toEqual({
      timeoutMs: 15 * 60 * 1000,
      promptBeforeIdleMs: 30 * 1000,
    });
  });

  it("never lets the prompt outlast the timeout", () => {
    expect(resolveIdleTimings("1", "600").promptBeforeIdleMs).toBe(60 * 1000);
  });
});
