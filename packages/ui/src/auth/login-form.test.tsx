import "@testing-library/jest-dom/vitest";

import { ThemeProvider } from "@cdorneles/theme";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { LoginForm } from "./login-form";

function renderForm(props: Parameters<typeof LoginForm>[0]) {
  return render(
    <ThemeProvider>
      <LoginForm {...props} />
    </ThemeProvider>,
  );
}

describe("LoginForm", () => {
  it("submits the entered credentials", async () => {
    const onSubmit = vi.fn();
    renderForm({ onSubmit });

    await userEvent.type(screen.getByLabelText("E-mail"), "user@example.com");
    await userEvent.type(screen.getByLabelText("Senha"), "secret");
    await userEvent.click(screen.getByRole("button", { name: "Entrar" }));

    expect(onSubmit).toHaveBeenCalledWith({ email: "user@example.com", password: "secret" });
  });

  it("submits the entered credentials on Enter", async () => {
    const onSubmit = vi.fn();
    renderForm({ onSubmit });

    await userEvent.type(screen.getByLabelText("E-mail"), "user@example.com");
    await userEvent.type(screen.getByLabelText("Senha"), "secret{Enter}");

    expect(onSubmit).toHaveBeenCalledWith({ email: "user@example.com", password: "secret" });
  });

  it("validates before submitting", async () => {
    const onSubmit = vi.fn();
    renderForm({ onSubmit });

    await userEvent.click(screen.getByRole("button", { name: "Entrar" }));

    // The message renders at the field and in the form-level alert.
    expect(await screen.findAllByText("Informe um e-mail válido.")).not.toHaveLength(0);
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("announces the first validation error through the form-level alert", async () => {
    renderForm({ onSubmit: vi.fn() });

    await userEvent.click(screen.getByRole("button", { name: "Entrar" }));

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("Informe um e-mail válido.");
  });

  it("focuses the first invalid field on submit", async () => {
    renderForm({ onSubmit: vi.fn() });

    await userEvent.click(screen.getByRole("button", { name: "Entrar" }));

    expect(screen.getByLabelText("E-mail")).toHaveFocus();
  });

  it("marks the password input invalid after a failed submit", async () => {
    renderForm({ onSubmit: vi.fn() });

    await userEvent.click(screen.getByRole("button", { name: "Entrar" }));

    expect(screen.getByLabelText("Senha")).toHaveAttribute("aria-invalid", "true");
  });

  it("shows a form-level error with role=alert", () => {
    renderForm({ onSubmit: vi.fn(), error: "E-mail ou senha inválidos." });

    expect(screen.getByRole("alert")).toHaveTextContent("E-mail ou senha inválidos.");
  });

  it("disables the submit while loading", () => {
    renderForm({ onSubmit: vi.fn(), loading: true });

    expect(screen.getByRole("button", { name: "Entrar" })).toBeDisabled();
  });

  it("does not submit while loading", async () => {
    const onSubmit = vi.fn();
    renderForm({ onSubmit, loading: true });

    await userEvent.click(screen.getByRole("button", { name: "Entrar" }));

    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("exposes the password visibility toggle to keyboard and assistive tech", async () => {
    renderForm({ onSubmit: vi.fn() });

    const toggle = screen.getByRole("button", { name: "Alternar visibilidade da senha" });
    expect(toggle).toHaveAttribute("aria-pressed", "false");

    await userEvent.click(toggle);

    expect(toggle).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByLabelText("Senha")).toHaveAttribute("type", "text");
  });

  it("keeps autocomplete hints for password managers", () => {
    renderForm({ onSubmit: vi.fn() });

    expect(screen.getByLabelText("E-mail")).toHaveAttribute("autocomplete", "email");
    expect(screen.getByLabelText("Senha")).toHaveAttribute("autocomplete", "current-password");
  });

  it("hides the sign-up link by default", () => {
    renderForm({ onSubmit: vi.fn() });

    expect(screen.queryByText("Criar conta")).not.toBeInTheDocument();
  });

  it("shows the sign-up link when enabled", () => {
    renderForm({ onSubmit: vi.fn(), showSignUp: true });

    expect(screen.getByText("Criar conta")).toBeInTheDocument();
  });

  it("renders a custom heading", () => {
    renderForm({ onSubmit: vi.fn(), heading: "Bem vindo" });

    expect(screen.getByRole("heading", { name: "Bem vindo" })).toBeInTheDocument();
  });

  it("defaults to 'Bem-vindo de volta' when no heading is provided", () => {
    renderForm({ onSubmit: vi.fn() });

    expect(screen.getByRole("heading", { name: "Bem-vindo de volta" })).toBeInTheDocument();
  });

  it("passes googleLabel to SocialLogin", () => {
    renderForm({ onSubmit: vi.fn(), googleLabel: "Continuar com Google" });

    expect(
      screen.getByRole("button", { name: "Continuar com Google" }),
    ).toBeInTheDocument();
  });

  it("aligns 'Esqueci minha senha' to the left", () => {
    renderForm({ onSubmit: vi.fn() });

    const link = screen.getByRole("button", { name: "Esqueci minha senha" });
    expect(link).toHaveStyle({ textAlign: "start" });
  });
});
