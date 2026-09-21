import "@testing-library/jest-dom/vitest";

import type { MantineTheme } from "@mantine/core";
import { semanticColors } from "@cdorneles/tokens";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { createAppTheme } from "./create-theme";
import { createThemePreference, resolveThemeMode } from "./preference";
import { ThemeProvider, cssVariablesResolver } from "./theme-provider";

describe("theme preference", () => {
  it("uses the organization default when there is no user override", () => {
    expect(resolveThemeMode({ organizationDefault: "dark", userOverride: null })).toBe("dark");
    expect(resolveThemeMode({ organizationDefault: "light" })).toBe("light");
  });

  it("lets the user override win", () => {
    expect(resolveThemeMode({ organizationDefault: "dark", userOverride: "light" })).toBe("light");
  });

  it("creates a light preference by default", () => {
    expect(createThemePreference()).toEqual({ organizationDefault: "light", userOverride: null });
  });
});

describe("createAppTheme", () => {
  it("uses the brand palette by default", () => {
    const theme = createAppTheme();
    expect(theme.primaryColor).toBe("brand");
    expect(theme.colors?.brand).toHaveLength(10);
  });

  it("derives a primary scale from organization branding", () => {
    const theme = createAppTheme({ branding: { primaryColor: "#0ea5e9" } });
    expect(theme.colors?.brand).toHaveLength(10);
    expect(theme.colors?.brand?.[5]).toBe("#0ea5e9");
  });

  it("ignores invalid branding colors and falls back to the default", () => {
    const theme = createAppTheme({ branding: { primaryColor: "not-a-color" } });
    expect(theme.colors?.brand).toHaveLength(10);
  });
});

describe("ThemeProvider", () => {
  it("renders its children", () => {
    render(
      <ThemeProvider organizationDefault="dark">
        <span>content</span>
      </ThemeProvider>,
    );
    expect(screen.getByText("content")).toBeInTheDocument();
  });
});

describe("css variables", () => {
  it("paints the page with the semantic background, not Mantine's white", () => {
    // The resolver ignores the theme it is handed; the cast only satisfies the
    // signature Mantine declares.
    const resolved = cssVariablesResolver({} as MantineTheme);

    expect(resolved.light?.["--mantine-color-body"]).toBe(semanticColors.light.background);
    expect(semanticColors.light.background).not.toBe("#ffffff");
  });

  it("keeps `dimmed` readable on the dark body", () => {
    // The resolver ignores the theme it is handed; the cast only satisfies the
    // signature Mantine declares.
    const resolved = cssVariablesResolver({} as MantineTheme);

    expect(resolved.dark?.["--mantine-color-dimmed"]).toBe("var(--mantine-color-gray-4)");
  });
});
