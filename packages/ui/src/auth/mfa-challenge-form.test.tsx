import "@testing-library/jest-dom/vitest";

import { ThemeProvider } from "@cdorneles/theme";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
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

  it("starts the resend button on cooldown", () => {
    const onSubmit = vi.fn();
    const onResend = vi.fn();
    renderForm({ onSubmit, onResend });

    const button = screen.getByRole("button", { name: /reenviar em 30s/i });
    expect(button).toBeInTheDocument();
    expect(button).toBeDisabled();
  });

  it("enables resend after 30s and restarts the cooldown on resend", async () => {
    vi.useFakeTimers();
    try {
      const onSubmit = vi.fn();
      const onResend = vi.fn().mockResolvedValue(undefined);
      renderForm({ onSubmit, onResend });

      expect(screen.getByRole("button", { name: /reenviar em 30s/i })).toBeDisabled();

      await act(async () => {
        vi.advanceTimersByTime(30_000);
      });

      const enabled = screen.getByRole("button", { name: /^reenviar código$/i });
      expect(enabled).toBeEnabled();

      await act(async () => {
        fireEvent.click(enabled);
      });

      expect(onResend).toHaveBeenCalledTimes(1);
      expect(screen.getByRole("button", { name: /reenviar em 30s/i })).toBeDisabled();
    } finally {
      vi.useRealTimers();
    }
  });

  it("does not render the resend button when onResend is not provided", () => {
    const onSubmit = vi.fn();
    renderForm({ onSubmit });

    expect(screen.queryByRole("button", { name: /reenviar código/i })).not.toBeInTheDocument();
  });
});
