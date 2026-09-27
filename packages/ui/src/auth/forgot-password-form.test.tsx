import "@testing-library/jest-dom/vitest";

import { ThemeProvider } from "@cdorneles/theme";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { ForgotPasswordForm } from "./forgot-password-form";

function renderForm(props: Parameters<typeof ForgotPasswordForm>[0]) {
  return render(
    <ThemeProvider>
      <ForgotPasswordForm {...props} />
    </ThemeProvider>,
  );
}

describe("ForgotPasswordForm", () => {
  it("renders the e-mail input and submit button", () => {
    const onSubmit = vi.fn();
    renderForm({ onSubmit });

    expect(screen.getByLabelText(/e-mail/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /enviar link/i })).toBeInTheDocument();
  });

  it("validates the e-mail before submitting", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    renderForm({ onSubmit });

    await user.click(screen.getByRole("button", { name: /enviar link/i }));

    expect(onSubmit).not.toHaveBeenCalled();
    expect(screen.getByText(/e-mail válido/i)).toBeInTheDocument();
  });

  it("calls onSubmit with the e-mail", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    renderForm({ onSubmit });

    await user.type(screen.getByLabelText(/e-mail/i), "user@example.com");
    await user.click(screen.getByRole("button", { name: /enviar link/i }));

    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalledWith({ email: "user@example.com" });
    });
  });

  it("shows the success message after submission", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    renderForm({ onSubmit });

    await user.type(screen.getByLabelText(/e-mail/i), "user@example.com");
    await user.click(screen.getByRole("button", { name: /enviar link/i }));

    await waitFor(() => {
      expect(screen.getByRole("status")).toHaveTextContent(/user@example.com/i);
    });
  });

  it("shows an error message when onSubmit fails", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn().mockRejectedValue(new Error("Falha ao enviar"));
    renderForm({ onSubmit });

    await user.type(screen.getByLabelText(/e-mail/i), "user@example.com");
    await user.click(screen.getByRole("button", { name: /enviar link/i }));

    await waitFor(() => {
      expect(screen.getByRole("alert")).toHaveTextContent(/Falha ao enviar/i);
    });
  });

  it("focuses the first invalid field on submit", async () => {
    const user = userEvent.setup();
    renderForm({ onSubmit: vi.fn() });

    await user.click(screen.getByRole("button", { name: /enviar link/i }));

    expect(screen.getByLabelText(/^e-mail/i)).toHaveFocus();
  });

  it("links the email input to its field error for assistive tech", async () => {
    const user = userEvent.setup();
    renderForm({ onSubmit: vi.fn() });

    await user.click(screen.getByRole("button", { name: /enviar link/i }));

    const email = screen.getByLabelText(/^e-mail/i);
    expect(email).toHaveAttribute("aria-invalid", "true");
    const describedBy = email.getAttribute("aria-describedby");
    expect(describedBy).toBeTruthy();
    const errorEl = document.getElementById(describedBy as string);
    expect(errorEl).toHaveTextContent(/e-mail válido/i);
  });

  it("points the form element at the alert while a submit error shows", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn().mockRejectedValue(new Error("Erro simulado."));
    const { container } = renderForm({ onSubmit });

    expect(container.querySelector("form")).not.toHaveAttribute("aria-describedby");

    await user.type(screen.getByLabelText(/^e-mail/i), "a@b.co");
    await user.click(screen.getByRole("button", { name: /enviar link/i }));

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("Erro simulado.");
    const form = container.querySelector("form");
    expect(form).toHaveAttribute("aria-describedby", "forgot-password-form-error");
    expect(document.getElementById("forgot-password-form-error")).toBeInTheDocument();
  });
});
