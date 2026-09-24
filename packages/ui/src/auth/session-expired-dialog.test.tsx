import "@testing-library/jest-dom/vitest";

import { MantineProvider } from "@mantine/core";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { SessionExpiredDialog, SessionExpiredMfaDialog } from "./session-expired-dialog";

// The required marker (" *") is part of the label text, and the visibility
// toggle's aria-label also mentions "senha", so scope the query to the input.
const passwordField = () => screen.getByLabelText(/senha/i, { selector: "input" });
const codeInputs = () => screen.getAllByLabelText(/código de verificação/i, { selector: "input" });

function renderDialog(props: Partial<Parameters<typeof SessionExpiredDialog>[0]> = {}) {
  const onSubmit = vi.fn().mockResolvedValue(undefined);
  const onSignOut = vi.fn();
  const view = render(
    <MantineProvider>
      <SessionExpiredDialog
        email="ana@exemplo.com"
        onSubmit={onSubmit}
        onSignOut={onSignOut}
        {...props}
      />
    </MantineProvider>,
  );
  const rerenderDialog = (next: Partial<Parameters<typeof SessionExpiredDialog>[0]>) =>
    view.rerender(
      <MantineProvider>
        <SessionExpiredDialog
          email="ana@exemplo.com"
          onSubmit={onSubmit}
          onSignOut={onSignOut}
          {...props}
          {...next}
        />
      </MantineProvider>,
    );
  return { onSubmit, onSignOut, rerenderDialog };
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
    expect(passwordField()).toHaveValue("errada");
  });

  it("offers a way out for an account with no password", async () => {
    const { onSignOut } = renderDialog();

    await userEvent.click(screen.getByRole("button", { name: /outra conta/i }));

    expect(onSignOut).toHaveBeenCalledTimes(1);
  });

  it("renders the provided Google node", () => {
    renderDialog({ google: <button>g</button> });

    expect(screen.getByRole("button", { name: "g" })).toBeInTheDocument();
  });

  it("shows a blocking overlay while loading and makes the content inert", () => {
    renderDialog({ loading: true });

    expect(screen.getByText("Entrando…")).toBeInTheDocument();

    const signOut = screen.getByRole("button", { name: /outra conta/i });
    expect(signOut.closest("[inert]")).not.toBeNull();
  });

  it("renders no Google option by default", () => {
    renderDialog();

    expect(screen.queryByText("ou")).not.toBeInTheDocument();
  });

  it("shows a caller-provided message", () => {
    renderDialog({ errorMessage: "Esta conta Google não corresponde à conta bloqueada." });

    expect(screen.getByRole("alert")).toHaveTextContent(
      "Esta conta Google não corresponde à conta bloqueada.",
    );
  });

  it("lets the local error take precedence over the caller message", async () => {
    const onSubmit = vi.fn().mockRejectedValue(new Error("Senha incorreta."));
    renderDialog({
      onSubmit,
      errorMessage: "Esta conta Google não corresponde à conta bloqueada.",
    });

    await userEvent.type(passwordField(), "errada");
    await userEvent.click(screen.getByRole("button", { name: "Entrar" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Senha incorreta.");
  });

  it("clears the local error when a Google credential starts", async () => {
    const onSubmit = vi.fn().mockRejectedValue(new Error("Senha incorreta."));
    const { rerenderDialog } = renderDialog({
      onSubmit,
      errorMessage: "Esta conta Google não corresponde à conta bloqueada.",
      googleResetToken: 0,
    });

    await userEvent.type(passwordField(), "errada");
    await userEvent.click(screen.getByRole("button", { name: "Entrar" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Senha incorreta.");

    rerenderDialog({ googleResetToken: 1 });

    await waitFor(() =>
      expect(screen.getByRole("alert")).toHaveTextContent(
        "Esta conta Google não corresponde à conta bloqueada.",
      ),
    );
  });
});

describe("SessionExpiredMfaDialog", () => {
  it("shows a single heading, from the challenge form", () => {
    render(
      <MantineProvider>
        <SessionExpiredMfaDialog onSubmit={vi.fn()} onSignOut={vi.fn()} />
      </MantineProvider>,
    );

    const headings = screen.getAllByRole("heading");
    expect(headings).toHaveLength(1);
    expect(headings[0]).toHaveTextContent("Verificação em duas etapas");
    expect(screen.queryByText("Confirme o código")).not.toBeInTheDocument();
  });

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

    await userEvent.click(codeInputs()[0]);
    await userEvent.keyboard("123456");

    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalledWith({ code: "123456" });
    });
  });
});
