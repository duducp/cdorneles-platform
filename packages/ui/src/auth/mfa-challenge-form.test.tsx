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

function codeInputs(): HTMLElement[] {
  return screen.getAllByLabelText(/código de verificação/i);
}

async function typeCode(user: ReturnType<typeof userEvent.setup>, code: string) {
  await user.click(codeInputs()[0]);
  await user.keyboard(code);
}

describe("MfaChallengeForm", () => {
  it("renders six digit boxes, each individually labelled", () => {
    const onSubmit = vi.fn();
    renderForm({ onSubmit });

    expect(codeInputs()).toHaveLength(6);
    expect(codeInputs()[0]).toHaveAccessibleName(/código de verificação, dígito 1 de 6/i);
    expect(codeInputs()[5]).toHaveAccessibleName(/código de verificação, dígito 6 de 6/i);
    expect(screen.getByRole("button", { name: /verificar código/i })).toBeInTheDocument();
  });

  it("focuses the first digit box on mount", () => {
    const onSubmit = vi.fn();
    renderForm({ onSubmit });

    expect(codeInputs()[0]).toHaveFocus();
  });

  it("clears the code and refocuses the first box after a rejected submit", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn().mockRejectedValue(new Error("Código inválido"));
    renderForm({ onSubmit });

    await typeCode(user, "123456");

    await waitFor(() => {
      expect(screen.getByRole("alert")).toHaveTextContent(/código inválido/i);
    });
    expect(codeInputs()[0]).toHaveValue("");
    expect(codeInputs()[0]).toHaveFocus();
  });

  it("validates the code before submitting", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    renderForm({ onSubmit });

    await user.click(screen.getByRole("button", { name: /verificar código/i }));

    expect(onSubmit).not.toHaveBeenCalled();
    expect(screen.getByText(/código de 6 dígitos/i)).toBeInTheDocument();
  });

  it("auto-submits exactly once when the sixth digit lands", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    renderForm({ onSubmit });

    await typeCode(user, "123456");

    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalledTimes(1);
      expect(onSubmit).toHaveBeenCalledWith({ code: "123456" });
    });
    expect(screen.getByRole("button", { name: /verificar código/i })).toBeInTheDocument();
  });

  it("shows the async error when auto-submit fails", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn().mockRejectedValue(new Error("Código expirado"));
    renderForm({ onSubmit });

    await typeCode(user, "123456");

    await waitFor(() => {
      expect(screen.getByRole("alert")).toHaveTextContent(/Código expirado/i);
    });
    expect(onSubmit).toHaveBeenCalledTimes(1);
  });

  it("does not resubmit while the value stays unchanged after a failure", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn().mockRejectedValue(new Error("Código inválido"));
    renderForm({ onSubmit });

    await typeCode(user, "123456");

    await waitFor(() => {
      expect(screen.getByRole("alert")).toHaveTextContent(/código inválido/i);
    });
    await new Promise((resolve) => {
      setTimeout(resolve, 50);
    });
    expect(onSubmit).toHaveBeenCalledTimes(1);
  });

  it("auto-submits the same code again after retyping it following a rejection", async () => {
    const user = userEvent.setup();
    const onSubmit = vi
      .fn()
      .mockRejectedValueOnce(new Error("Código expirado"))
      .mockResolvedValue(undefined);
    renderForm({ onSubmit });

    await typeCode(user, "123456");

    await waitFor(() => {
      expect(screen.getByRole("alert")).toHaveTextContent(/Código expirado/i);
    });
    expect(codeInputs()[0]).toHaveValue("");

    await typeCode(user, "123456");

    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalledTimes(2);
    });
    expect(onSubmit).toHaveBeenLastCalledWith({ code: "123456" });
  });

  it("resubmits with the newly typed code after a rejection", async () => {
    const user = userEvent.setup();
    const onSubmit = vi
      .fn()
      .mockRejectedValueOnce(new Error("Código inválido"))
      .mockResolvedValue(undefined);
    renderForm({ onSubmit });

    await typeCode(user, "123456");
    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalledTimes(1);
    });

    await typeCode(user, "123457");

    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalledTimes(2);
    });
    expect(onSubmit).toHaveBeenLastCalledWith({ code: "123457" });
  });

  it("accepts a pasted full code and auto-submits", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    renderForm({ onSubmit });

    await user.click(codeInputs()[0]);
    await user.paste("123456");

    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalledWith({ code: "123456" });
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

  it("renders the cancel button when onCancel is given", () => {
    const onSubmit = vi.fn();
    const onCancel = vi.fn();
    renderForm({ onSubmit, onCancel });

    const cancel = screen.getByRole("button", { name: /^cancelar$/i });
    expect(cancel).toBeInTheDocument();
    expect(cancel).toHaveAttribute("type", "button");
  });

  it("omits the cancel button when onCancel is omitted", () => {
    const onSubmit = vi.fn();
    renderForm({ onSubmit });

    expect(screen.queryByRole("button", { name: /^cancelar$/i })).not.toBeInTheDocument();
  });

  it("calls onCancel without submitting the form", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    const onCancel = vi.fn();
    renderForm({ onSubmit, onCancel });

    await typeCode(user, "123456");
    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalledTimes(1);
    });
    onSubmit.mockClear();

    await user.click(screen.getByRole("button", { name: /^cancelar$/i }));

    expect(onCancel).toHaveBeenCalledTimes(1);
    expect(onSubmit).not.toHaveBeenCalled();
  });
});
