import "@testing-library/jest-dom/vitest";

import { MantineProvider } from "@mantine/core";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import {
  SessionExpiredDialog,
  SessionExpiredMfaDialog,
} from "./session-expired-dialog";

// The required marker (" *") is part of the label text, and the visibility
// toggle's aria-label also mentions "senha", so scope the query to the input.
const passwordField = () => screen.getByLabelText(/senha/i, { selector: "input" });
const codeField = () => screen.getByLabelText(/código de verificação/i, { selector: "input" });

function renderDialog(props: Partial<Parameters<typeof SessionExpiredDialog>[0]> = {}) {
  const onSubmit = vi.fn().mockResolvedValue(undefined);
  const onSignOut = vi.fn();
  render(
    <MantineProvider>
      <SessionExpiredDialog
        email="ana@exemplo.com"
        onSubmit={onSubmit}
        onSignOut={onSignOut}
        {...props}
      />
    </MantineProvider>,
  );
  return { onSubmit, onSignOut };
}

describe("SessionExpiredDialog", () => {
  it("shows the known e-mail and focuses the password field", async () => {
    renderDialog();

    expect(screen.getByLabelText("Conta")).toHaveValue("ana@exemplo.com");
    await waitFor(() => expect(passwordField()).toHaveFocus());
  });

  it("cannot be dismissed with Escape", async () => {
    const { onSignOut } = renderDialog();

    await userEvent.keyboard("{Escape}");

    expect(passwordField()).toBeInTheDocument();
    expect(onSignOut).not.toHaveBeenCalled();
  });

  it("submits the password", async () => {
    const { onSubmit } = renderDialog();

    await userEvent.type(passwordField(), "segredo123");
    await userEvent.click(screen.getByRole("button", { name: "Entrar" }));

    expect(onSubmit).toHaveBeenCalledWith("segredo123");
  });

  it("keeps the failure inline so it can be re-read", async () => {
    const onSubmit = vi.fn().mockRejectedValue(new Error("Senha incorreta."));
    renderDialog({ onSubmit });

    await userEvent.type(passwordField(), "errada");
    await userEvent.click(screen.getByRole("button", { name: "Entrar" }));

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("Senha incorreta.");
  });

  it("offers a way out for an account with no password", async () => {
    const { onSignOut } = renderDialog();

    await userEvent.click(screen.getByRole("button", { name: /outra conta/i }));

    expect(onSignOut).toHaveBeenCalledTimes(1);
  });

  it("renders the Google option when provided", async () => {
    const onGoogleClick = vi.fn();
    renderDialog({ google: { onClick: onGoogleClick } });

    await userEvent.click(screen.getByRole("button", { name: "Continuar com Google" }));

    expect(onGoogleClick).toHaveBeenCalledOnce();
  });

  it("shows a blocking overlay while loading", () => {
    renderDialog({ loading: true });

    expect(screen.getByText("Entrando…")).toBeInTheDocument();
  });

  it("renders no Google option by default", () => {
    renderDialog();

    expect(screen.queryByRole("button", { name: "Continuar com Google" })).not.toBeInTheDocument();
  });

  it("propagates label and disabled to the Google option", () => {
    renderDialog({ google: { onClick: vi.fn(), label: "Entrar com Google", disabled: true } });

    expect(screen.getByRole("button", { name: "Entrar com Google" })).toBeDisabled();
  });

  it("shows a caller-provided message", () => {
    renderDialog({ errorMessage: "Esta conta Google não corresponde à conta bloqueada." });

    expect(screen.getByRole("alert")).toHaveTextContent(
      "Esta conta Google não corresponde à conta bloqueada.",
    );
  });

  it("lets the local error take precedence and clears it for the caller", async () => {
    const onSubmit = vi.fn().mockRejectedValue(new Error("Senha incorreta."));
    const onGoogleClick = vi.fn();
    renderDialog({
      onSubmit,
      google: { onClick: onGoogleClick },
      errorMessage: "Esta conta Google não corresponde à conta bloqueada.",
    });

    await userEvent.type(passwordField(), "errada");
    await userEvent.click(screen.getByRole("button", { name: "Entrar" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Senha incorreta.");

    await userEvent.click(screen.getByRole("button", { name: "Continuar com Google" }));

    expect(onGoogleClick).toHaveBeenCalledOnce();
    expect(screen.getByRole("alert")).toHaveTextContent(
      "Esta conta Google não corresponde à conta bloqueada.",
    );
  });
});

describe("SessionExpiredMfaDialog", () => {
  it("takes the code in the same non-dismissible shell", async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    const onSignOut = vi.fn();
    render(
      <MantineProvider>
        <SessionExpiredMfaDialog onSubmit={onSubmit} onSignOut={onSignOut} />
      </MantineProvider>,
    );

    await userEvent.keyboard("{Escape}");
    expect(screen.getByRole("button", { name: /entrar com outra conta/i })).toBeInTheDocument();

    await userEvent.type(codeField(), "123456");
    await userEvent.click(screen.getByRole("button", { name: "Verificar código" }));

    expect(onSubmit).toHaveBeenCalledWith({ code: "123456" });
  });
});
