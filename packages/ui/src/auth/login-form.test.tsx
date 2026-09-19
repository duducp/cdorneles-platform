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

    expect(await screen.findByText("Informe um e-mail válido.")).toBeInTheDocument();
    expect(onSubmit).not.toHaveBeenCalled();
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

  it("hides the sign-up link by default", () => {
    renderForm({ onSubmit: vi.fn() });

    expect(screen.queryByText("Criar conta")).not.toBeInTheDocument();
  });

  it("shows the sign-up link when enabled", () => {
    renderForm({ onSubmit: vi.fn(), showSignUp: true });

    expect(screen.getByText("Criar conta")).toBeInTheDocument();
  });
});
