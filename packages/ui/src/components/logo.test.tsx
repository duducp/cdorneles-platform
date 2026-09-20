import "@testing-library/jest-dom/vitest";

import { ThemeProvider } from "@cdorneles/theme";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { Logo } from "./logo";

const renderLogo = (props: Parameters<typeof Logo>[0]) =>
  render(
    <ThemeProvider>
      <Logo {...props} />
    </ThemeProvider>,
  );

const sources = () =>
  screen.getAllByAltText("Cdorneles").map((img) => img.getAttribute("src"));

describe("Logo", () => {
  it("renders both light and dark sources so CSS can pick one", () => {
    renderLogo({ alt: "Cdorneles", lightSrc: "/l.png", darkSrc: "/d.png" });

    expect(sources()).toEqual(["/l.png", "/d.png"]);
  });

  it("defaults to the platform brand paths", () => {
    renderLogo({ alt: "Cdorneles" });

    expect(sources()).toEqual(["/brand/logo-light.png", "/brand/logo-dark.png"]);
  });
});
