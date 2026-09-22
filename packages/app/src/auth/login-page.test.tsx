import "@testing-library/jest-dom/vitest";

import { ThemeProvider } from "@cdorneles/theme";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("@cdorneles/auth", () => ({
  useAuth: () => ({ login: vi.fn() }),
  useRedirectIfAuthenticated: () => true,
  resolvePostAuthRedirect: () => "/",
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

  it("shows 'Continuar com Google novamente' when last login was Google", () => {
    localStorage.setItem("cdorneles-last-login-method", "google");
    renderPage();

    expect(
      screen.getByRole("button", { name: "Continuar com Google novamente" }),
    ).toBeInTheDocument();
  });

  it("does not render the terms footer text", () => {
    renderPage();

    expect(screen.queryByText(/Termos de Uso/)).not.toBeInTheDocument();
  });
});
