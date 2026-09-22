import "@testing-library/jest-dom/vitest";

import { MantineProvider } from "@mantine/core";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { useAuthMock, invalidateMock, idleCallbacks } = vi.hoisted(() => ({
  useAuthMock: vi.fn(),
  invalidateMock: vi.fn(),
  idleCallbacks: { current: {} as Record<string, () => void> },
}));

vi.mock("@cdorneles/auth", async () => {
  const actual = await vi.importActual<typeof import("@cdorneles/auth")>("@cdorneles/auth");
  return { ...actual, useAuth: useAuthMock };
});
vi.mock("@tanstack/react-query", () => ({
  useQueryClient: () => ({ invalidateQueries: invalidateMock }),
}));
vi.mock("next/navigation", () => ({ usePathname: () => "/dashboard" }));
vi.mock("react-idle-timer", () => ({
  useIdleTimer: (options: Record<string, unknown>) => {
    idleCallbacks.current = options as Record<string, () => void>;
    return { activate: vi.fn(), getRemainingTime: () => 30_000 };
  },
}));

const { IdleLockGate } = await import("./idle-lock-gate");

function renderGate() {
  return render(
    <MantineProvider>
      <div data-testid="page">rascunho do usuário</div>
      <IdleLockGate />
    </MantineProvider>,
  );
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
