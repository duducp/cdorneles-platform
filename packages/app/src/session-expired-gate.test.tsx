import "@testing-library/jest-dom/vitest";

import { act, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const originalLocationDescriptor = Object.getOwnPropertyDescriptor(window, "location");

const {
  useAuthMock,
  SessionExpiredDialogMock,
  SessionExpiredMfaDialogMock,
  MfaRequiredErrorMock,
  queryClientMock,
  oneTapProps,
} = vi.hoisted(() => ({
  useAuthMock: vi.fn(),
  SessionExpiredDialogMock: vi.fn((props: Record<string, unknown>) => (
    <div data-testid="password-dialog">{props.google as never}</div>
  )),
  SessionExpiredMfaDialogMock: vi.fn((_props: Record<string, unknown>) => (
    <div data-testid="mfa-dialog" />
  )),
  MfaRequiredErrorMock: class MfaRequiredError extends Error {
    override name = "MfaRequiredError" as const;
  },
  queryClientMock: {
    cancelQueries: vi.fn().mockResolvedValue(undefined),
    invalidateQueries: vi.fn().mockResolvedValue(undefined),
  },
  oneTapProps: {
    current: null as null | {
      buttonParentRef?: { current: HTMLDivElement | null };
      onCredential?: (idToken: string) => void;
      onError?: (error: unknown) => void;
      onStart?: () => void;
    },
  },
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
  useQueryClient: () => queryClientMock,
}));

vi.mock("./auth/google-one-tap", () => ({
  GoogleOneTap: (props: Record<string, unknown>) => {
    oneTapProps.current = props as unknown as NonNullable<typeof oneTapProps.current>;
    return null;
  },
  describeOneTapError: () => "Não foi possível entrar com o Google. Tente novamente.",
  // In these tests the ID token is the e-mail, which keeps the fixtures short.
  readIdTokenEmail: (idToken: string) => idToken,
}));

const { SessionExpiredGate } = await import("./session-expired-gate");

function authState(
  overrides: Partial<
    Record<
      | "sessionState"
      | "user"
      | "service"
      | "refresh"
      | "reauthenticate"
      | "loginWithOneTap"
      | "logout",
      unknown
    >
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
      listMfaFactors: vi.fn().mockResolvedValue({ totp: true, email: false }),
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
    if (originalLocationDescriptor) {
      Object.defineProperty(window, "location", originalLocationDescriptor);
    } else {
      Reflect.deleteProperty(window, "location");
    }
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

  it("cancels stale queries and broadcasts the renewal after a password success", async () => {
    const reauthenticate = vi.fn().mockResolvedValue({});
    useAuthMock.mockReturnValue(
      authState({
        sessionState: "expired",
        user: { email: "user@example.com" },
        reauthenticate,
      }),
    );
    const { rerender } = render(<SessionExpiredGate />);

    const dialogProps = SessionExpiredDialogMock.mock.calls.at(-1)?.[0] as {
      onSubmit: (password: string) => Promise<void>;
    };
    await act(async () => {
      await dialogProps.onSubmit("secret");
    });

    expect(reauthenticate).toHaveBeenCalledWith({ email: "user@example.com", password: "secret" });
    expect(queryClientMock.cancelQueries).toHaveBeenCalled();
    expect(queryClientMock.invalidateQueries).toHaveBeenCalled();
    expect(window.localStorage.getItem("cdorneles-session-renewed")).not.toBeNull();

    useAuthMock.mockReturnValue(
      authState({ sessionState: "active", user: { email: "user@example.com" } }),
    );
    rerender(<SessionExpiredGate />);
    expect(screen.queryByTestId("password-dialog")).not.toBeInTheDocument();
  });

  it("still broadcasts the renewal when invalidating the queries fails", async () => {
    queryClientMock.invalidateQueries.mockRejectedValueOnce(new Error("offline"));
    const reauthenticate = vi.fn().mockResolvedValue({});
    useAuthMock.mockReturnValue(
      authState({
        sessionState: "expired",
        user: { email: "user@example.com" },
        reauthenticate,
      }),
    );
    render(<SessionExpiredGate />);

    const dialogProps = SessionExpiredDialogMock.mock.calls.at(-1)?.[0] as {
      onSubmit: (password: string) => Promise<void>;
    };
    await act(async () => {
      await expect(dialogProps.onSubmit("secret")).resolves.toBeUndefined();
    });

    expect(window.localStorage.getItem("cdorneles-session-renewed")).not.toBeNull();
  });

  it("signs out and navigates to the login page", async () => {
    const logout = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(window, "location", {
      configurable: true,
      writable: true,
      value: { href: "" },
    });
    useAuthMock.mockReturnValue(
      authState({
        sessionState: "expired",
        user: { email: "user@example.com" },
        logout,
      }),
    );
    render(<SessionExpiredGate />);

    const dialogProps = SessionExpiredDialogMock.mock.calls.at(-1)?.[0] as {
      onSignOut: () => void;
    };
    await act(async () => {
      dialogProps.onSignOut();
    });

    expect(logout).toHaveBeenCalled();
    await waitFor(() => expect(window.location.href).toBe("/login"));
  });

  it("shows the loading overlay while the Google exchange runs", async () => {
    let resolveLogin: (value: unknown) => void = () => {};
    const loginWithOneTap = vi.fn(
      () =>
        new Promise((resolve) => {
          resolveLogin = resolve;
        }),
    );
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

    await waitFor(() => {
      const props = SessionExpiredDialogMock.mock.calls.at(-1)?.[0] as { loading?: boolean };
      expect(props.loading).toBe(true);
    });

    await act(async () => {
      resolveLogin({});
    });

    await waitFor(() => {
      const props = SessionExpiredDialogMock.mock.calls.at(-1)?.[0] as { loading?: boolean };
      expect(props.loading).toBe(false);
    });
  });

  it("clears the loading overlay when a plain exchange error is thrown", async () => {
    const loginWithOneTap = vi.fn().mockRejectedValue(new Error("boom"));
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

    await waitFor(() => {
      const props = SessionExpiredDialogMock.mock.calls.at(-1)?.[0] as { loading?: boolean };
      expect(props.loading).toBe(false);
    });
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

  it("passes the Google container to the dialog and the One Tap component", () => {
    useAuthMock.mockReturnValue(
      authState({ sessionState: "expired", user: { email: "user@example.com" } }),
    );
    render(<SessionExpiredGate />);

    const props = SessionExpiredDialogMock.mock.calls.at(-1)?.[0] as { google?: unknown };
    expect(props.google).toBeDefined();
    expect(oneTapProps.current?.buttonParentRef?.current).toBeInstanceOf(HTMLDivElement);
  });

  it("bumps the dialog's Google reset token when a credential starts", () => {
    useAuthMock.mockReturnValue(
      authState({ sessionState: "expired", user: { email: "user@example.com" } }),
    );
    render(<SessionExpiredGate />);

    const before = (
      SessionExpiredDialogMock.mock.calls.at(-1)?.[0] as { googleResetToken?: number }
    ).googleResetToken;

    act(() => {
      oneTapProps.current?.onStart?.();
    });

    const after = (
      SessionExpiredDialogMock.mock.calls.at(-1)?.[0] as { googleResetToken?: number }
    ).googleResetToken;

    expect(after).not.toBe(before);
    expect(after).toBe((before ?? 0) + 1);
  });

  it("surfaces a One Tap failure through the dialog message", () => {
    useAuthMock.mockReturnValue(
      authState({ sessionState: "expired", user: { email: "user@example.com" } }),
    );
    render(<SessionExpiredGate />);

    act(() => {
      oneTapProps.current?.onError?.(new Error("boom"));
    });

    const props = SessionExpiredDialogMock.mock.calls.at(-1)?.[0] as { errorMessage?: string };
    expect(props.errorMessage).toBe("Não foi possível entrar com o Google. Tente novamente.");
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

  it("prefers the email factor and offers resend", async () => {
    const createMfaChallenge = vi.fn().mockResolvedValue({ challengeId: "ch1", factor: "email" });
    const listMfaFactors = vi.fn().mockResolvedValue({ totp: true, email: true });
    useAuthMock.mockReturnValue(
      authState({
        sessionState: "expired",
        user: { email: "user@example.com" },
        reauthenticate: vi.fn().mockRejectedValue(new MfaRequiredErrorMock()),
        service: { createMfaChallenge, listMfaFactors },
      }),
    );
    render(<SessionExpiredGate />);

    const dialogProps = SessionExpiredDialogMock.mock.calls.at(-1)?.[0] as {
      onSubmit: (password: string) => Promise<void>;
    };
    await act(async () => {
      await dialogProps.onSubmit("secret").catch(() => {});
    });

    await waitFor(() => expect(createMfaChallenge).toHaveBeenCalledWith({ factor: "email" }));
    const mfaProps = SessionExpiredMfaDialogMock.mock.calls.at(-1)?.[0] as {
      onResend?: () => Promise<void>;
    };
    expect(mfaProps.onResend).toBeTypeOf("function");

    await act(async () => {
      await mfaProps.onResend?.();
    });
    expect(createMfaChallenge).toHaveBeenCalledTimes(2);
    expect(createMfaChallenge).toHaveBeenLastCalledWith({ factor: "email" });
  });

  it("does not offer resend for the totp factor", async () => {
    const createMfaChallenge = vi.fn().mockResolvedValue({ challengeId: "ch1", factor: "totp" });
    const listMfaFactors = vi.fn().mockResolvedValue({ totp: true, email: false });
    useAuthMock.mockReturnValue(
      authState({
        sessionState: "expired",
        user: { email: "user@example.com" },
        reauthenticate: vi.fn().mockRejectedValue(new MfaRequiredErrorMock()),
        service: { createMfaChallenge, listMfaFactors },
      }),
    );
    render(<SessionExpiredGate />);

    const dialogProps = SessionExpiredDialogMock.mock.calls.at(-1)?.[0] as {
      onSubmit: (password: string) => Promise<void>;
    };
    await act(async () => {
      await dialogProps.onSubmit("secret").catch(() => {});
    });

    await waitFor(() => expect(createMfaChallenge).toHaveBeenCalledWith({ factor: "totp" }));
    const mfaProps = SessionExpiredMfaDialogMock.mock.calls.at(-1)?.[0] as { onResend?: unknown };
    expect(mfaProps.onResend).toBeUndefined();
  });

  it("rejects with the missing-factor message when the account has no MFA factor", async () => {
    const listMfaFactors = vi.fn().mockResolvedValue({ totp: false, email: false });
    useAuthMock.mockReturnValue(
      authState({
        sessionState: "expired",
        user: { email: "user@example.com" },
        reauthenticate: vi.fn().mockRejectedValue(new MfaRequiredErrorMock()),
        service: { createMfaChallenge: vi.fn(), listMfaFactors },
      }),
    );
    render(<SessionExpiredGate />);

    const dialogProps = SessionExpiredDialogMock.mock.calls.at(-1)?.[0] as {
      onSubmit: (password: string) => Promise<void>;
    };

    await expect(dialogProps.onSubmit("secret")).rejects.toThrow(/fator de verificação/i);
  });

  it("rejects with the generic message when starting the challenge fails", async () => {
    const listMfaFactors = vi.fn().mockRejectedValue(new Error("network"));
    useAuthMock.mockReturnValue(
      authState({
        sessionState: "expired",
        user: { email: "user@example.com" },
        reauthenticate: vi.fn().mockRejectedValue(new MfaRequiredErrorMock()),
        service: { createMfaChallenge: vi.fn(), listMfaFactors },
      }),
    );
    render(<SessionExpiredGate />);

    const dialogProps = SessionExpiredDialogMock.mock.calls.at(-1)?.[0] as {
      onSubmit: (password: string) => Promise<void>;
    };

    await expect(dialogProps.onSubmit("secret")).rejects.toThrow(
      "Erro ao iniciar a verificação em duas etapas.",
    );
  });
});
