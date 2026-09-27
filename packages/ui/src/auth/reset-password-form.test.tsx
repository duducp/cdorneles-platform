import "@testing-library/jest-dom/vitest";

import { ThemeProvider } from "@cdorneles/theme";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { ResetPasswordForm } from "./reset-password-form";

function renderForm(props: Parameters<typeof ResetPasswordForm>[0]) {
  return render(
    <ThemeProvider>
      <ResetPasswordForm {...props} />
    </ThemeProvider>,
  );
}

describe("ResetPasswordForm", () => {
  it("renders two password inputs and a submit button", () => {
    const onSubmit = vi.fn();
    renderForm({ onSubmit });

    expect(screen.getByPlaceholderText(/mínimo 8 caracteres/i)).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/repita a nova senha/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /redefinir senha/i })).toBeInTheDocument();
  });

  it("validates password length before submitting", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    renderForm({ onSubmit });

    await user.type(screen.getByPlaceholderText(/mínimo 8 caracteres/i), "short");
    await user.type(screen.getByPlaceholderText(/repita a nova senha/i), "short");
    await user.click(screen.getByRole("button", { name: /redefinir senha/i }));

    expect(onSubmit).not.toHaveBeenCalled();
    expect(screen.getByText(/pelo menos 8 caracteres/i)).toBeInTheDocument();
  });

  it("validates password confirmation mismatch", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    renderForm({ onSubmit });

    await user.type(screen.getByPlaceholderText(/mínimo 8 caracteres/i), "s3cret-pass");
    await user.type(screen.getByPlaceholderText(/repita a nova senha/i), "other-pass");
    await user.click(screen.getByRole("button", { name: /redefinir senha/i }));

    expect(onSubmit).not.toHaveBeenCalled();
    expect(screen.getByText(/não coincidem/i)).toBeInTheDocument();
  });

  it("calls onSubmit with the new password", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    renderForm({ onSubmit });

    await user.type(screen.getByPlaceholderText(/mínimo 8 caracteres/i), "s3cret-pass");
    await user.type(screen.getByPlaceholderText(/repita a nova senha/i), "s3cret-pass");
    await user.click(screen.getByRole("button", { name: /redefinir senha/i }));

    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalledWith({
        password: "s3cret-pass",
        passwordConfirmation: "s3cret-pass",
      });
    });
  });

  it("shows the success message after submission", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    renderForm({ onSubmit });

    await user.type(screen.getByPlaceholderText(/mínimo 8 caracteres/i), "s3cret-pass");
    await user.type(screen.getByPlaceholderText(/repita a nova senha/i), "s3cret-pass");
    await user.click(screen.getByRole("button", { name: /redefinir senha/i }));

    await waitFor(() => {
      expect(screen.getByRole("status")).toHaveTextContent(/senha redefinida/i);
    });
  });

  it("shows an error message when onSubmit fails", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn().mockRejectedValue(new Error("Token expirado"));
    renderForm({ onSubmit });

    await user.type(screen.getByPlaceholderText(/mínimo 8 caracteres/i), "s3cret-pass");
    await user.type(screen.getByPlaceholderText(/repita a nova senha/i), "s3cret-pass");
    await user.click(screen.getByRole("button", { name: /redefinir senha/i }));

    await waitFor(() => {
      expect(screen.getByRole("alert")).toHaveTextContent(/Token expirado/i);
    });
  });

  it("focuses the first invalid field on submit", async () => {
    const user = userEvent.setup();
    renderForm({ onSubmit: vi.fn() });

    await user.click(screen.getByRole("button", { name: /redefinir senha/i }));

    expect(screen.getByLabelText(/^nova senha/i)).toHaveFocus();
  });

  it("focuses the confirmation field when only the confirmation is invalid", async () => {
    const user = userEvent.setup();
    renderForm({ onSubmit: vi.fn() });

    await user.type(screen.getByLabelText(/^nova senha/i), "senha1234");
    await user.click(screen.getByRole("button", { name: /redefinir senha/i }));

    expect(screen.getByLabelText(/^confirmar nova senha/i)).toHaveFocus();
  });

  it("points the form element at the alert while a submit error shows", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn().mockRejectedValue(new Error("Erro simulado."));
    const { container } = renderForm({ onSubmit });

    expect(container.querySelector("form")).not.toHaveAttribute("aria-describedby");

    await user.type(screen.getByLabelText(/^nova senha/i), "senha1234");
    await user.type(screen.getByLabelText(/^confirmar nova senha/i), "senha1234");
    await user.click(screen.getByRole("button", { name: /redefinir senha/i }));

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("Erro simulado.");
    const form = container.querySelector("form");
    expect(form).toHaveAttribute("aria-describedby", "reset-password-form-error");
    expect(document.getElementById("reset-password-form-error")).toBeInTheDocument();
  });
});
