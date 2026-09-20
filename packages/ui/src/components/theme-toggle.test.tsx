import "@testing-library/jest-dom/vitest";

import { ThemeProvider } from "@cdorneles/theme";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import { ThemeToggle } from "./theme-toggle";

describe("ThemeToggle", () => {
  it("exposes a static accessible name and renders both scheme icons", () => {
    render(
      <ThemeProvider>
        <ThemeToggle />
      </ThemeProvider>,
    );

    const button = screen.getByRole("button", { name: "Alternar tema claro/escuro" });

    // Both icons are rendered; CSS picks the visible one from the color scheme.
    expect(button.querySelectorAll("svg")).toHaveLength(2);
  });

  it("switches the color scheme on click", async () => {
    render(
      <ThemeProvider>
        <ThemeToggle />
      </ThemeProvider>,
    );

    await userEvent.click(screen.getByRole("button", { name: "Alternar tema claro/escuro" }));

    expect(document.documentElement).toHaveAttribute("data-mantine-color-scheme", "dark");
  });
});
