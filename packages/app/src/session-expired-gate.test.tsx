import "@testing-library/jest-dom/vitest";

import { act, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const {
  useAuthMock,
  SessionExpiredDialogMock,
  SessionExpiredMfaDialogMock,
  MfaRequiredErrorMock,
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
  oneTapProps: {
    current: null as null | {
      buttonParentRef?: { current: HTMLDivElement | null };
      onCredential?: (idToken: string) => void;
      onError?: (error: unknown) => void;
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
  useQueryClient: () => ({ invalidateQueries: vi.fn() }),
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
      "sessionState" | "user" | "service" | "refresh" | "reauthenticate" | "loginWithOneTap",
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

  it("surfaces an error when the account has no MFA factor", async () => {
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
    await act(async () => {
      await dialogProps.onSubmit("secret").catch(() => {});
    });

    await waitFor(() => {
      const latest = SessionExpiredDialogMock.mock.calls.at(-1)?.[0] as { errorMessage?: string };
      expect(latest.errorMessage).toMatch(/fator de verificação/i);
    });
  });

  it("does not report a missing factor when starting the challenge fails", async () => {
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
    await act(async () => {
      await dialogProps.onSubmit("secret").catch(() => {});
    });

    await waitFor(() => {
      const latest = SessionExpiredDialogMock.mock.calls.at(-1)?.[0] as { errorMessage?: string };
      expect(latest.errorMessage).toMatch(/Erro ao iniciar a verificação/i);
      expect(latest.errorMessage).not.toMatch(/Nenhum fator/i);
    });
  });
});
