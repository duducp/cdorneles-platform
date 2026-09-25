import "@testing-library/jest-dom/vitest";

import type { MantineTheme } from "@mantine/core";
import { elevation, elevationShadows, fontWeights, semanticColors } from "@cdorneles/tokens";
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

  it("registers the dark palette from the tokens", () => {
    const theme = createAppTheme();

    expect(theme.colors?.dark).toHaveLength(10);
    expect(theme.colors?.dark?.[7]).toBe("#0d1117");
  });

  it("renders headings at the guide's bold weight", () => {
    const theme = createAppTheme();

    expect(theme.headings?.fontWeight).toBe(String(fontWeights.bold));
    expect(theme.headings?.fontWeight).not.toBe(String(fontWeights.semibold));
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
  // The resolver ignores the theme it is handed; the cast only satisfies the
  // signature Mantine declares.
  const resolve = () => cssVariablesResolver({} as MantineTheme);

  it("paints the page with the semantic background, not Mantine's white", () => {
    const resolved = resolve();

    expect(resolved.light?.["--mantine-color-body"]).toBe(semanticColors.light.background);
    expect(semanticColors.light.background).not.toBe("#ffffff");
  });

  it("paints the dark page with the semantic dark background", () => {
    const resolved = resolve();

    expect(resolved.dark?.["--mantine-color-body"]).toBe(semanticColors.dark.background);
    expect(semanticColors.dark.background).toBe("#0d1117");
  });

  it("keeps `dimmed` readable on the dark body", () => {
    const resolved = resolve();

    expect(resolved.dark?.["--mantine-color-dimmed"]).toBe("var(--mantine-color-dark-3)");
  });

  it("resolves shadows per scheme, dark casts from GitHub's near-black ink", () => {
    const resolved = resolve();

    expect(resolved.variables?.["--cd-shadow-md"]).toBe(elevationShadows.light.md);
    expect(resolved.dark?.["--cd-shadow-md"]).toBe(elevationShadows.dark.md);
    expect(elevationShadows.dark.md).toContain("rgba(1, 4, 9");
    // Every shadow token is a scheme-aware variable reference.
    expect(elevation.xs).toBe("var(--cd-shadow-xs)");
    expect(elevation.lg).toBe("var(--cd-shadow-lg)");
  });

  it("switches subtle chip fills to translucent tints in dark", () => {
    const resolved = resolve();

    expect(resolved.dark?.["--mantine-color-brand-light"]).toBe("var(--mantine-color-brand-8)");
    expect(resolved.dark?.["--mantine-color-success-light"]).toBe(
      "var(--mantine-color-success-8)",
    );
    expect(resolved.dark?.["--mantine-color-gray-light"]).toBe("var(--mantine-color-gray-8)");
    expect(resolved.dark?.["--mantine-color-gray-light-hover"]).toBe(
      "var(--mantine-color-gray-7)",
    );
    expect(resolved.dark?.["--mantine-color-gray-light-color"]).toBe(
      "var(--mantine-color-gray-2)",
    );
  });

  it("wires the error color to the danger palette per scheme", () => {
    const resolved = resolve();

    expect(semanticColors.light.error).toBe("#dc2626");
    expect(semanticColors.dark.error).toBe("#f87171");
    expect(resolved.dark?.["--mantine-color-error"]).toBe(semanticColors.dark.error);
  });

  it("exposes the semantic muted surface for borderless surfaces", () => {
    const resolved = resolve();

    expect(resolved.variables?.["--cd-surface-muted"]).toBe(semanticColors.light.surfaceMuted);
    expect(resolved.dark?.["--cd-surface-muted"]).toBe(semanticColors.dark.surfaceMuted);
  });
});
