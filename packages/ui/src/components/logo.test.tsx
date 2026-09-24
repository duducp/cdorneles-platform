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
  screen.getAllByAltText("Carlos Dorneles").map((img) => img.getAttribute("src"));

describe("Logo", () => {
  it("renders both light and dark sources so CSS can pick one", () => {
    renderLogo({ alt: "Carlos Dorneles", lightSrc: "/l.png", darkSrc: "/d.png" });

    expect(sources()).toEqual(["/l.png", "/d.png"]);
  });

  it("defaults to the platform brand paths", () => {
    renderLogo({ alt: "Carlos Dorneles" });

    expect(sources()).toEqual(["/brand/logo-light.webp", "/brand/logo-dark.webp"]);
  });

  it("defaults to the horizontal brand paths for the horizontal variant", () => {
    renderLogo({ alt: "Carlos Dorneles", variant: "horizontal" });

    expect(sources()).toEqual(["/brand/logo-light-h.webp", "/brand/logo-dark-h.webp"]);
  });

  it("uses a wider default aspect ratio for the horizontal variant", () => {
    const { unmount: unmountDefault } = renderLogo({ alt: "Carlos Dorneles", height: 48 });
    const defaultWidth = screen.getAllByAltText("Carlos Dorneles")[0].style.width;
    unmountDefault();

    renderLogo({ alt: "Carlos Dorneles", variant: "horizontal", height: 48 });
    const horizontalWidth = screen.getAllByAltText("Carlos Dorneles")[0].style.width;

    // Mantine emits widths as `calc(<n>rem * var(--mantine-scale))`.
    const rem = (value: string) => parseFloat(value.match(/[\d.]+rem/)?.[0] ?? "0");
    expect(rem(horizontalWidth)).toBeGreaterThan(rem(defaultWidth));
  });

  it("renders the symbol-only mark for the symbol variant", () => {
    renderLogo({ alt: "Carlos Dorneles", variant: "symbol" });

    expect(sources()).toEqual(["/brand/favicon.png"]);
  });

  it("lets explicit sources override the variant defaults", () => {
    renderLogo({
      alt: "Carlos Dorneles",
      variant: "horizontal",
      lightSrc: "/custom/light.png",
      darkSrc: "/custom/dark.png",
    });

    expect(sources()).toEqual(["/custom/light.png", "/custom/dark.png"]);
  });
});
