import "@testing-library/jest-dom/vitest";

import { ThemeProvider } from "@cdorneles/theme";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi, beforeEach } from "vitest";

const { loginWithGoogleMock } = vi.hoisted(() => ({ loginWithGoogleMock: vi.fn() }));

vi.mock("@cdorneles/auth", () => ({
  useAuth: () => ({ login: vi.fn(), loginWithGoogle: loginWithGoogleMock }),
  useRedirectIfAuthenticated: () => true,
  resolvePostAuthRedirect: () => "/dashboard",
  MfaRequiredError: class MfaRequiredError extends Error {},
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: vi.fn(), push: vi.fn() }),
}));

import { LoginPage } from "./login-page";

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

    expect(
      screen.getByRole("button", { name: "Continuar com Google" }),
    ).toBeInTheDocument();
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
});
