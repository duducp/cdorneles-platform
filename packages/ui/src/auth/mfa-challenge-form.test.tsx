import "@testing-library/jest-dom/vitest";

import { ThemeProvider } from "@cdorneles/theme";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { MfaChallengeForm } from "./mfa-challenge-form";

function renderForm(props: Parameters<typeof MfaChallengeForm>[0]) {
  return render(
    <ThemeProvider>
      <MfaChallengeForm {...props} />
    </ThemeProvider>,
  );
}

describe("MfaChallengeForm", () => {
  it("renders the code input and submit button", () => {
    const onSubmit = vi.fn();
    renderForm({ onSubmit });

    expect(screen.getByLabelText(/código de verificação/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /verificar código/i })).toBeInTheDocument();
  });

  it("validates the code before submitting", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    renderForm({ onSubmit });

    await user.click(screen.getByRole("button", { name: /verificar código/i }));

    expect(onSubmit).not.toHaveBeenCalled();
    expect(screen.getByText(/código de 6 dígitos/i)).toBeInTheDocument();
  });

  it("calls onSubmit with the code", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    renderForm({ onSubmit });

    await user.type(screen.getByLabelText(/código de verificação/i), "123456");
    await user.click(screen.getByRole("button", { name: /verificar código/i }));

    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalledWith({ code: "123456" });
    });
  });

  it("shows an error message when onSubmit fails", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn().mockRejectedValue(new Error("Código expirado"));
    renderForm({ onSubmit });

    await user.type(screen.getByLabelText(/código de verificação/i), "123456");
    await user.click(screen.getByRole("button", { name: /verificar código/i }));

    await waitFor(() => {
      expect(screen.getByRole("alert")).toHaveTextContent(/Código expirado/i);
    });
  });

  it("renders the resend button when onResend is provided", () => {
    const onSubmit = vi.fn();
    const onResend = vi.fn();
    renderForm({ onSubmit, onResend });

    expect(screen.getByRole("button", { name: /reenviar código/i })).toBeInTheDocument();
  });

  it("does not render the resend button when onResend is not provided", () => {
    const onSubmit = vi.fn();
    renderForm({ onSubmit });

    expect(screen.queryByRole("button", { name: /reenviar código/i })).not.toBeInTheDocument();
  });
});
