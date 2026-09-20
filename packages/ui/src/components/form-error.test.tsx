import "@testing-library/jest-dom/vitest";

import { ThemeProvider } from "@cdorneles/theme";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { FormError } from "./form-error";

function renderError(ui: React.ReactElement) {
  return render(<ThemeProvider>{ui}</ThemeProvider>);
}

describe("FormError", () => {
  it("renders nothing without a message", () => {
    renderError(<FormError>{null}</FormError>);

    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("renders the message with an accessible alert role", () => {
    renderError(<FormError>E-mail ou senha inválidos.</FormError>);

    expect(screen.getByRole("alert")).toHaveTextContent("E-mail ou senha inválidos.");
  });

  it("renders the message text, not color alone", () => {
    renderError(<FormError>Código inválido.</FormError>);

    expect(screen.getByText("Código inválido.")).toBeInTheDocument();
  });
});
