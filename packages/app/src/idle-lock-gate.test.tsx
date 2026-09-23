import "@testing-library/jest-dom/vitest";

import type * as AuthModule from "@cdorneles/auth";
import { MantineProvider } from "@mantine/core";
import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { useAuthMock, invalidateMock, idleCallbacks, activateMock, oneTapProps, promptMock } =
  vi.hoisted(() => ({
    useAuthMock: vi.fn(),
    invalidateMock: vi.fn(),
    idleCallbacks: { current: {} as Record<string, () => void> },
    activateMock: vi.fn(),
    oneTapProps: {
      current: null as null | {
        onCredential?: (idToken: string) => void;
        onError?: (error: unknown) => void;
      },
    },
    promptMock: vi.fn(),
  }));

vi.mock("@cdorneles/auth", async () => {
  const actual = await vi.importActual<typeof AuthModule>("@cdorneles/auth");
  return {
    ...actual,
    useAuth: useAuthMock,
    describeAuthError: (error: Error) => error.message,
  };
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
vi.mock("./auth/google-one-tap", async () => {
  const { forwardRef, useImperativeHandle } = await import("react");
  return {
    GoogleOneTap: forwardRef<{ prompt: (onUnavailable?: () => void) => void }>(
      function MockGoogleOneTap(props, ref) {
        oneTapProps.current = props as {
          onCredential?: (idToken: string) => void;
          onError?: (error: unknown) => void;
        };
        useImperativeHandle(
          ref,
          () => ({ prompt: (onUnavailable?: () => void) => promptMock(onUnavailable) }),
          [],
        );
        return null;
      },
    ),
    describeOneTapError: () => "Não foi possível entrar com o Google. Tente novamente.",
    // In these tests the ID token is the e-mail, which keeps the fixtures short.
    readIdTokenEmail: (idToken: string) => idToken,
  };
});

const { IdleLockGate, resolveIdleTimings } = await import("./idle-lock-gate");
const { MfaRequiredError } = await import("@cdorneles/auth");

function authState(overrides: Record<string, unknown> = {}) {
  return {
    status: "authenticated",
    sessionState: "active",
    user: { id: "u1", email: "a@b.c", name: "A", emailVerified: true, mfaEnabled: false },
    reauthenticate: vi.fn().mockResolvedValue(undefined),
    completeReauthMfa: vi.fn(),
    loginWithOneTap: vi.fn().mockResolvedValue({}),
    logout: vi.fn(),
    service: {
      createMfaChallenge: vi.fn().mockResolvedValue({ challengeId: "ch1", factor: "totp" }),
    },
    ...overrides,
  };
}

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
    vi.stubEnv("NEXT_PUBLIC_GOOGLE_CLIENT_ID", "client-id.apps.googleusercontent.com");
    oneTapProps.current = null;
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

  afterEach(() => {
    vi.unstubAllEnvs();
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

    await waitFor(() =>
      expect(reauthenticate).toHaveBeenCalledWith({ email: "a@b.c", password: "segredo123" }),
    );
    expect(invalidateMock).toHaveBeenCalled();
    await waitFor(() => expect(screen.queryByText("Tela bloqueada")).not.toBeInTheDocument());
  });

  it("resets the idle timer when the user continues", async () => {
    renderGate();

    idleCallbacks.current.onPrompt();
    await screen.findByText(/será bloqueada em/i);

    await userEvent.click(screen.getByRole("button", { name: /continuar trabalhando/i }));

    expect(activateMock).toHaveBeenCalledTimes(1);
    expect(activateMock).toHaveBeenCalledWith();
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

  it("feeds the resolved defaults to the idle timer", () => {
    renderGate();

    expect(idleCallbacks.current.timeout).toBe(15 * 60 * 1000);
    expect(idleCallbacks.current.promptBeforeIdle).toBe(30 * 1000);
  });

  it("unlocks when another tab unlocks", async () => {
    renderGate();

    idleCallbacks.current.onIdle();
    await screen.findByText("Tela bloqueada");

    window.dispatchEvent(new StorageEvent("storage", { key: "cdorneles-idle-unlocked" }));

    await waitFor(() => expect(screen.queryByText("Tela bloqueada")).not.toBeInTheDocument());
  });

  it("unlocks when Google returns the locked account", async () => {
    const loginWithOneTap = vi.fn().mockResolvedValue({});
    useAuthMock.mockReturnValue(authState({ loginWithOneTap }));
    renderGate();

    idleCallbacks.current.onIdle();
    await screen.findByText("Tela bloqueada");

    act(() => {
      oneTapProps.current?.onCredential?.("A@B.C");
    });

    await waitFor(() => expect(loginWithOneTap).toHaveBeenCalledWith({ idToken: "A@B.C" }));
    await waitFor(() => expect(screen.queryByText("Tela bloqueada")).not.toBeInTheDocument());
  });

  it("rejects a Google account that does not match the locked one", async () => {
    const loginWithOneTap = vi.fn();
    useAuthMock.mockReturnValue(authState({ loginWithOneTap }));
    renderGate();

    idleCallbacks.current.onIdle();
    await screen.findByText("Tela bloqueada");

    act(() => {
      oneTapProps.current?.onCredential?.("X@Y.Z");
    });

    expect(await screen.findByText(/não corresponde/i)).toBeInTheDocument();
    expect(loginWithOneTap).not.toHaveBeenCalled();
  });

  it("shows a generic message when the Google token has no usable e-mail", async () => {
    const loginWithOneTap = vi.fn();
    useAuthMock.mockReturnValue(authState({ loginWithOneTap }));
    renderGate();

    idleCallbacks.current.onIdle();
    await screen.findByText("Tela bloqueada");

    act(() => {
      oneTapProps.current?.onCredential?.("");
    });

    expect(await screen.findByText(/Não foi possível entrar com o Google/i)).toBeInTheDocument();
    expect(loginWithOneTap).not.toHaveBeenCalled();
  });

  it("maps other Google failures to a message", async () => {
    const loginWithOneTap = vi.fn().mockRejectedValue(new Error("boom"));
    useAuthMock.mockReturnValue(authState({ loginWithOneTap }));
    renderGate();

    idleCallbacks.current.onIdle();
    await screen.findByText("Tela bloqueada");

    act(() => {
      oneTapProps.current?.onCredential?.("a@b.c");
    });

    expect(await screen.findByText("boom")).toBeInTheDocument();
  });

  it("offers no Google when the kill switch is off", async () => {
    vi.stubEnv("NEXT_PUBLIC_GOOGLE_AUTH_ENABLED", "false");
    renderGate();

    idleCallbacks.current.onIdle();
    await screen.findByText("Tela bloqueada");

    expect(oneTapProps.current).toBeNull();
    expect(screen.queryByRole("button", { name: "Continuar com Google" })).not.toBeInTheDocument();
  });

  it("offers no Google when no client id is configured", async () => {
    vi.stubEnv("NEXT_PUBLIC_GOOGLE_CLIENT_ID", "");
    renderGate();

    idleCallbacks.current.onIdle();
    await screen.findByText("Tela bloqueada");

    expect(oneTapProps.current).toBeNull();
    expect(screen.queryByRole("button", { name: "Continuar com Google" })).not.toBeInTheDocument();
  });

  it("routes a Google MFA challenge to the code step", async () => {
    const loginWithOneTap = vi.fn().mockRejectedValue(new MfaRequiredError());
    useAuthMock.mockReturnValue(authState({ loginWithOneTap }));
    renderGate();

    idleCallbacks.current.onIdle();
    await screen.findByText("Tela bloqueada");

    act(() => {
      oneTapProps.current?.onCredential?.("a@b.c");
    });

    expect(
      await screen.findByLabelText(/código de verificação/i, { selector: "input" }),
    ).toBeInTheDocument();
  });

  it("re-opens the Google prompt and hints when it cannot open", async () => {
    renderGate();

    idleCallbacks.current.onIdle();
    await screen.findByText("Tela bloqueada");

    await userEvent.click(screen.getByRole("button", { name: "Continuar com Google" }));
    expect(promptMock).toHaveBeenCalledOnce();

    act(() => {
      promptMock.mock.calls.at(-1)?.[0]?.();
    });

    expect(await screen.findByText(/Não foi possível abrir o Google/i)).toBeInTheDocument();
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

  it("keeps the prompt strictly below the timeout", () => {
    const timings = resolveIdleTimings("1", "600");
    expect(timings.promptBeforeIdleMs).toBeLessThan(timings.timeoutMs);
  });

  it("bounds an absurd timeout", () => {
    expect(resolveIdleTimings("100000", undefined).timeoutMs).toBe(24 * 60 * 60 * 1000);
  });
});
