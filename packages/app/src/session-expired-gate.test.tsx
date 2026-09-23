import "@testing-library/jest-dom/vitest";

import { act, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const {
  useAuthMock,
  SessionExpiredDialogMock,
  SessionExpiredMfaDialogMock,
  MfaRequiredErrorMock,
  oneTapProps,
  promptMock,
} = vi.hoisted(() => ({
  useAuthMock: vi.fn(),
  SessionExpiredDialogMock: vi.fn((_props: Record<string, unknown>) => (
    <div data-testid="password-dialog" />
  )),
  SessionExpiredMfaDialogMock: vi.fn((_props: Record<string, unknown>) => (
    <div data-testid="mfa-dialog" />
  )),
  MfaRequiredErrorMock: class MfaRequiredError extends Error {
    override name = "MfaRequiredError" as const;
  },
  oneTapProps: {
    current: null as null | {
      onCredential?: (idToken: string) => void;
      onError?: (error: unknown) => void;
    },
  },
  promptMock: vi.fn(),
}));

vi.mock("@cdorneles/auth", () => ({
  useAuth: useAuthMock,
  MfaRequiredError: MfaRequiredErrorMock,
  describeAuthError: vi.fn((e: Error) => e.message),
}));

vi.mock("@cdorneles/ui", () => ({
  SessionExpiredDialog: SessionExpiredDialogMock,
  SessionExpiredMfaDialog: SessionExpiredMfaDialogMock,
}));

vi.mock("@tanstack/react-query", () => ({
  useQueryClient: () => ({ invalidateQueries: vi.fn() }),
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

const { SessionExpiredGate } = await import("./session-expired-gate");

function authState(
  overrides: Partial<
    Record<"sessionState" | "user" | "service" | "refresh" | "loginWithOneTap", unknown>
  > = {},
) {
  return {
    sessionState: "active",
    user: null,
    refresh: vi.fn(),
    reauthenticate: vi.fn(),
    completeReauthMfa: vi.fn(),
    loginWithOneTap: vi.fn().mockResolvedValue({}),
    logout: vi.fn(),
    service: {
      createMfaChallenge: vi.fn().mockResolvedValue({ challengeId: "ch1", factor: "totp" }),
    },
    ...overrides,
  };
}

describe("SessionExpiredGate", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.localStorage.clear();
    oneTapProps.current = null;
    vi.stubEnv("NEXT_PUBLIC_GOOGLE_CLIENT_ID", "client-id.apps.googleusercontent.com");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("renders nothing when sessionState is active", () => {
    useAuthMock.mockReturnValue(authState());
    const { container } = render(<SessionExpiredGate />);
    expect(container.innerHTML).toBe("");
  });

  it("renders nothing when sessionState is expired but user is null", () => {
    useAuthMock.mockReturnValue(authState({ sessionState: "expired" }));
    const { container } = render(<SessionExpiredGate />);
    expect(container.innerHTML).toBe("");
  });

  it("renders SessionExpiredDialog when sessionState is expired and user exists", () => {
    useAuthMock.mockReturnValue(
      authState({
        sessionState: "expired",
        user: { email: "user@example.com" },
      }),
    );
    render(<SessionExpiredGate />);
    expect(screen.getByTestId("password-dialog")).toBeInTheDocument();
  });

  it("revalidates when another tab renews the session", () => {
    const refreshMock = vi.fn();
    useAuthMock.mockReturnValue(
      authState({
        sessionState: "expired",
        user: { email: "user@example.com" },
        refresh: refreshMock,
      }),
    );

    render(<SessionExpiredGate />);

    window.dispatchEvent(new StorageEvent("storage", { key: "cdorneles-session-renewed" }));

    expect(refreshMock).toHaveBeenCalled();
  });

  it("unlocks when Google returns the expired account", async () => {
    const loginWithOneTap = vi.fn().mockResolvedValue({});
    useAuthMock.mockReturnValue(
      authState({
        sessionState: "expired",
        user: { email: "user@example.com" },
        loginWithOneTap,
      }),
    );
    render(<SessionExpiredGate />);

    act(() => {
      oneTapProps.current?.onCredential?.("user@example.com");
    });

    await waitFor(() =>
      expect(loginWithOneTap).toHaveBeenCalledWith({ idToken: "user@example.com" }),
    );
    expect(window.localStorage.getItem("cdorneles-session-renewed")).not.toBeNull();
  });

  it("rejects a Google account that does not match the expired one", async () => {
    const loginWithOneTap = vi.fn();
    useAuthMock.mockReturnValue(
      authState({
        sessionState: "expired",
        user: { email: "user@example.com" },
        loginWithOneTap,
      }),
    );
    render(<SessionExpiredGate />);

    act(() => {
      oneTapProps.current?.onCredential?.("other@example.com");
    });

    const props = SessionExpiredDialogMock.mock.calls.at(-1)?.[0] as {
      errorMessage?: string;
    };
    expect(props.errorMessage).toMatch(/não corresponde/i);
    expect(loginWithOneTap).not.toHaveBeenCalled();
  });

  it("routes a Google MFA challenge to the code dialog", async () => {
    const loginWithOneTap = vi.fn().mockRejectedValue(new MfaRequiredErrorMock());
    useAuthMock.mockReturnValue(
      authState({
        sessionState: "expired",
        user: { email: "user@example.com" },
        loginWithOneTap,
      }),
    );
    render(<SessionExpiredGate />);

    act(() => {
      oneTapProps.current?.onCredential?.("user@example.com");
    });

    expect(await screen.findByTestId("mfa-dialog")).toBeInTheDocument();
  });

  it("offers Google re-auth and opens the prompt", () => {
    useAuthMock.mockReturnValue(
      authState({ sessionState: "expired", user: { email: "user@example.com" } }),
    );
    render(<SessionExpiredGate />);

    const props = SessionExpiredDialogMock.mock.calls.at(-1)?.[0] as {
      google?: { onClick: () => void };
    };
    expect(props.google).toBeDefined();

    act(() => props.google?.onClick());

    expect(promptMock).toHaveBeenCalledOnce();
  });

  it("matches the locked account case-insensitively", async () => {
    const loginWithOneTap = vi.fn().mockResolvedValue({});
    useAuthMock.mockReturnValue(
      authState({
        sessionState: "expired",
        user: { email: "user@example.com" },
        loginWithOneTap,
      }),
    );
    render(<SessionExpiredGate />);

    act(() => {
      oneTapProps.current?.onCredential?.("USER@EXAMPLE.COM");
    });

    await waitFor(() =>
      expect(loginWithOneTap).toHaveBeenCalledWith({ idToken: "USER@EXAMPLE.COM" }),
    );
  });

  it("offers no Google when no client id is configured", () => {
    vi.stubEnv("NEXT_PUBLIC_GOOGLE_CLIENT_ID", "");
    useAuthMock.mockReturnValue(
      authState({ sessionState: "expired", user: { email: "user@example.com" } }),
    );
    render(<SessionExpiredGate />);

    const props = SessionExpiredDialogMock.mock.calls.at(-1)?.[0] as { google?: unknown };
    expect(props.google).toBeUndefined();
    expect(oneTapProps.current).toBeNull();
  });

  it("offers no Google when the kill switch is off", () => {
    vi.stubEnv("NEXT_PUBLIC_GOOGLE_AUTH_ENABLED", "false");
    useAuthMock.mockReturnValue(
      authState({ sessionState: "expired", user: { email: "user@example.com" } }),
    );
    render(<SessionExpiredGate />);

    const props = SessionExpiredDialogMock.mock.calls.at(-1)?.[0] as { google?: unknown };
    expect(props.google).toBeUndefined();
    expect(oneTapProps.current).toBeNull();
  });

  it("surfaces the unavailable hint when the prompt cannot open", () => {
    useAuthMock.mockReturnValue(
      authState({ sessionState: "expired", user: { email: "user@example.com" } }),
    );
    render(<SessionExpiredGate />);

    const props = SessionExpiredDialogMock.mock.calls.at(-1)?.[0] as {
      google?: { onClick: () => void };
    };
    act(() => props.google?.onClick());
    act(() => promptMock.mock.calls.at(-1)?.[0]?.());

    const latest = SessionExpiredDialogMock.mock.calls.at(-1)?.[0] as { errorMessage?: string };
    expect(latest.errorMessage).toMatch(/Não foi possível abrir o Google/i);
  });
});
