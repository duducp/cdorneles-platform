import "@testing-library/jest-dom/vitest";

import { ThemeProvider } from "@cdorneles/theme";
import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";

const { pushMock, replaceMock, oneTapProps, promptMock } = vi.hoisted(() => ({
  pushMock: vi.fn(),
  replaceMock: vi.fn(),
  oneTapProps: {
    current: null as null | {
      onError: (error: unknown) => void;
      onSuccess?: () => void;
      onStart?: () => void;
    },
  },
  promptMock: vi.fn(),
}));

vi.mock("@cdorneles/auth", () => ({
  useAuth: () => ({
    login: vi.fn(),
    status: "anonymous",
  }),
  useRedirectIfAuthenticated: () => true,
  resolvePostAuthRedirect: () => "/dashboard",
  MfaRequiredError: class MfaRequiredError extends Error {},
}));

vi.mock("./google-one-tap", async () => {
  const { forwardRef, useImperativeHandle } = await import("react");
  return {
    GoogleOneTap: forwardRef<{ prompt: (onUnavailable?: () => void) => void }>(
      function MockGoogleOneTap(props, ref) {
        oneTapProps.current = props as unknown as NonNullable<typeof oneTapProps.current>;
        useImperativeHandle(
          ref,
          () => ({ prompt: (onUnavailable?: () => void) => promptMock(onUnavailable) }),
          [],
        );
        return null;
      },
    ),
    describeOneTapError: (error: unknown) => `mapped:${String(error)}`,
  };
});

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: replaceMock, push: pushMock }),
}));

import { LoginPage } from "./login-page";
import { MfaRequiredError } from "@cdorneles/auth";

function renderPage() {
  return render(
    <ThemeProvider>
      <LoginPage />
    </ThemeProvider>,
  );
}

describe("LoginPage", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  beforeEach(() => {
    localStorage.clear();
    oneTapProps.current = null;
    vi.clearAllMocks();
    vi.stubEnv("NEXT_PUBLIC_GOOGLE_CLIENT_ID", "client-id.apps.googleusercontent.com");
    window.history.replaceState({}, "", "/login");
  });

  it("shows 'Bem vindo' when there is no previous login", () => {
    renderPage();

    expect(screen.getByRole("heading", { name: "Bem vindo" })).toBeInTheDocument();
  });

  it("shows 'Bem-vindo de volta' when there is a previous login", () => {
    localStorage.setItem("cdorneles-last-login-method", "email");
    renderPage();

    expect(screen.getByRole("heading", { name: "Bem-vindo de volta" })).toBeInTheDocument();
  });

  it("shows 'Entrar com Google' when last login was not Google", () => {
    renderPage();

    expect(screen.getByRole("button", { name: "Entrar com Google" })).toBeInTheDocument();
  });

  it("shows 'Continuar com Google' when last login was Google", () => {
    localStorage.setItem("cdorneles-last-login-method", "google");
    renderPage();

    expect(screen.getByRole("button", { name: "Continuar com Google" })).toBeInTheDocument();
  });

  it("does not render the terms footer text", () => {
    renderPage();

    expect(screen.queryByText(/Termos de Uso/)).not.toBeInTheDocument();
  });

  it("opens the One Tap prompt from the Google button", async () => {
    renderPage();

    await userEvent.click(screen.getByRole("button", { name: "Entrar com Google" }));

    expect(promptMock).toHaveBeenCalledTimes(1);
    expect(localStorage.getItem("cdorneles-last-login-method")).toBe("google");
  });

  it("hints to use email and password when the prompt cannot open", async () => {
    renderPage();

    await userEvent.click(screen.getByRole("button", { name: "Entrar com Google" }));
    act(() => {
      promptMock.mock.calls.at(-1)?.[0]?.();
    });

    expect(await screen.findByText(/Não foi possível abrir o Google/i)).toBeInTheDocument();
  });

  it("routes a One Tap MFA challenge to the MFA page", async () => {
    renderPage();

    expect(oneTapProps.current).not.toBeNull();
    act(() => {
      oneTapProps.current?.onError(new MfaRequiredError());
    });

    expect(pushMock).toHaveBeenCalledWith("/mfa?redirect=%2Fdashboard");
  });

  it("maps other One Tap failures to a display message", async () => {
    renderPage();

    expect(oneTapProps.current).not.toBeNull();
    act(() => {
      oneTapProps.current?.onError(new Error("boom"));
    });

    expect(pushMock).not.toHaveBeenCalled();
    expect(await screen.findByText("mapped:Error: boom")).toBeInTheDocument();
  });

  it("shows the loading overlay while One Tap validates and clears it on error", async () => {
    renderPage();

    expect(oneTapProps.current).not.toBeNull();
    act(() => {
      oneTapProps.current?.onStart?.();
    });
    expect(await screen.findByText("Entrando…")).toBeInTheDocument();

    act(() => {
      oneTapProps.current?.onError?.(new Error("boom"));
    });
    expect(screen.queryByText("Entrando…")).not.toBeInTheDocument();
  });

  it("clears the loading overlay and navigates when One Tap succeeds", async () => {
    renderPage();

    expect(oneTapProps.current).not.toBeNull();
    act(() => {
      oneTapProps.current?.onStart?.();
    });
    expect(await screen.findByText("Entrando…")).toBeInTheDocument();

    act(() => {
      oneTapProps.current?.onSuccess?.();
    });
    expect(screen.queryByText("Entrando…")).not.toBeInTheDocument();
    expect(replaceMock).toHaveBeenCalledWith("/dashboard");
  });

  it("hides Google when no client id is configured", () => {
    vi.stubEnv("NEXT_PUBLIC_GOOGLE_CLIENT_ID", "");
    renderPage();

    expect(oneTapProps.current).toBeNull();
    expect(screen.queryByRole("button", { name: "Entrar com Google" })).not.toBeInTheDocument();
  });

  it("hides Google entirely when the kill switch is off", () => {
    vi.stubEnv("NEXT_PUBLIC_GOOGLE_AUTH_ENABLED", "false");
    renderPage();

    expect(oneTapProps.current).toBeNull();
    expect(screen.queryByRole("button", { name: "Entrar com Google" })).not.toBeInTheDocument();
  });
});
