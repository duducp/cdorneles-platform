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

    // The message renders at the field only — never in the form-level alert.
    expect(await screen.findByText("Informe um e-mail válido.")).toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("links the email input to its field error for assistive tech", async () => {
    renderForm({ onSubmit: vi.fn() });

    await userEvent.click(screen.getByRole("button", { name: "Entrar" }));

    const email = screen.getByLabelText("E-mail");
    expect(email).toHaveAttribute("aria-invalid", "true");
    const describedBy = email.getAttribute("aria-describedby");
    expect(describedBy).toBeTruthy();
    const errorEl = document.getElementById(describedBy as string);
    expect(errorEl).toHaveTextContent("Informe um e-mail válido.");
  });

  it("renders the captcha slot right before the submit button", () => {
    const { container } = renderForm({
      onSubmit: vi.fn(),
      captchaSlot: <div data-testid="captcha" />,
    });
    const captcha = screen.getByTestId("captcha");
    const submit = screen.getByRole("button", { name: /entrar/i });
    expect(captcha.nextElementSibling).toBe(submit);
    expect(container).toBeTruthy();
  });

  it("renders the form-level alert as the first element of the form", () => {
    const { container } = renderForm({
      onSubmit: vi.fn(),
      error: "E-mail ou senha inválidos.",
    });

    const form = container.querySelector("form");
    expect(form?.firstElementChild).toHaveAttribute("role", "alert");
    expect(form?.firstElementChild).toHaveTextContent("E-mail ou senha inválidos.");
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

  it("renders the provided google slot with the divider", () => {
    renderForm({ onSubmit: vi.fn(), googleSlot: <div data-testid="google-slot" /> });

    expect(screen.getByTestId("google-slot")).toBeInTheDocument();
    expect(screen.getByText("OU CONTINUE COM")).toBeInTheDocument();
  });

  it("hides the google slot and divider when showGoogle is false", () => {
    renderForm({
      onSubmit: vi.fn(),
      showGoogle: false,
      googleSlot: <div data-testid="google-slot" />,
    });

    expect(screen.queryByTestId("google-slot")).not.toBeInTheDocument();
    expect(screen.queryByText("OU CONTINUE COM")).not.toBeInTheDocument();
  });

  it("renders no Google content without a slot", () => {
    renderForm({ onSubmit: vi.fn() });

    expect(screen.queryByText("OU CONTINUE COM")).not.toBeInTheDocument();
  });

  it("aligns 'Esqueci minha senha' to the left", () => {
    renderForm({ onSubmit: vi.fn() });

    const link = screen.getByRole("button", { name: "Esqueci minha senha" });
    expect(link).toHaveStyle({ textAlign: "start" });
  });
});
