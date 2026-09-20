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
});
