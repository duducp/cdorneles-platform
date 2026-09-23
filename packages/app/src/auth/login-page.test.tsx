import "@testing-library/jest-dom/vitest";

import { ThemeProvider } from "@cdorneles/theme";
import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi, beforeEach } from "vitest";

const { loginWithGoogleMock, loginWithOneTapMock, pushMock, replaceMock, oneTapProps } =
  vi.hoisted(() => ({
    loginWithGoogleMock: vi.fn(),
    loginWithOneTapMock: vi.fn(),
    pushMock: vi.fn(),
    replaceMock: vi.fn(),
    oneTapProps: { current: null as null | { onError: (error: unknown) => void } },
  }));

vi.mock("@cdorneles/auth", () => ({
  useAuth: () => ({
    login: vi.fn(),
    loginWithGoogle: loginWithGoogleMock,
    loginWithOneTap: loginWithOneTapMock,
    status: "anonymous",
  }),
  useRedirectIfAuthenticated: () => true,
  resolvePostAuthRedirect: () => "/dashboard",
  MfaRequiredError: class MfaRequiredError extends Error {},
}));

vi.mock("./google-one-tap", () => ({
  GoogleOneTap: (props: { onError: (error: unknown) => void }) => {
    oneTapProps.current = props;
    return null;
  },
  describeOneTapError: (error: unknown) => `mapped:${String(error)}`,
}));

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
  beforeEach(() => {
    localStorage.clear();
    oneTapProps.current = null;
    vi.clearAllMocks();
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

  it("starts the Google OAuth flow with the success and failure URLs", async () => {
    renderPage();

    await userEvent.click(screen.getByRole("button", { name: "Entrar com Google" }));

    expect(loginWithGoogleMock).toHaveBeenCalledWith({
      successUrl: `${window.location.origin}/dashboard`,
      failureUrl: `${window.location.origin}/login?error=google`,
    });
  });

  it("shows an error when the provider returns with ?error=google", async () => {
    window.history.replaceState({}, "", "/login?error=google");
    renderPage();

    expect(
      await screen.findByText("Não foi possível entrar com o Google. Tente novamente."),
    ).toBeInTheDocument();
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
});
