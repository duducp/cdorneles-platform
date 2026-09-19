import "@testing-library/jest-dom/vitest";

import { ThemeProvider } from "@cdorneles/theme";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { Logo } from "./logo";

describe("Logo", () => {
  it("renders the light source with the given alt", () => {
    render(
      <ThemeProvider>
        <Logo alt="Cdorneles" lightSrc="/l.png" darkSrc="/d.png" />
      </ThemeProvider>,
    );

    expect(screen.getByAltText("Cdorneles")).toHaveAttribute("src", "/l.png");
  });

  it("defaults to the platform brand paths", () => {
    render(
      <ThemeProvider>
        <Logo alt="Cdorneles" />
      </ThemeProvider>,
    );

    expect(screen.getByAltText("Cdorneles")).toHaveAttribute("src", "/brand/logo-light.png");
  });

  it("applies the given height", () => {
    render(
      <ThemeProvider>
        <Logo alt="Cdorneles" height={36} />
      </ThemeProvider>,
    );

    expect(screen.getByAltText("Cdorneles")).toHaveAttribute("height", "36");
  });
});
