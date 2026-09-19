import "@testing-library/jest-dom/vitest";

import { ThemeProvider } from "@cdorneles/theme";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import { ThemeToggle } from "./theme-toggle";

describe("ThemeToggle", () => {
  it("exposes an accessible name and toggles the label", async () => {
    render(
      <ThemeProvider>
        <ThemeToggle />
      </ThemeProvider>,
    );

    const button = screen.getByRole("button", { name: /Ativar tema/ });
    const initial = button.getAttribute("aria-label");

    await userEvent.click(button);

    const next = screen.getByRole("button", { name: /Ativar tema/ }).getAttribute("aria-label");
    expect(next).not.toBe(initial);
  });
});
