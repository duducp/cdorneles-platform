import {
  brand,
  createColorScale,
  danger,
  dark,
  density,
  fontFamily,
  fontWeights,
  gray,
  info,
  lineHeights,
  mantineBreakpoints,
  mantineFontSizes,
  mantineRadius,
  mantineShadows,
  mantineSpacing,
  semanticColors,
  success,
  warning,
} from "@cdorneles/tokens";
import type { Branding } from "@cdorneles/types";
import { createTheme, type MantineColorsTuple, type MantineThemeOverride } from "@mantine/core";

export interface CreateAppThemeOptions {
  /** Organization white-label branding. Colors are expanded into scales. */
  branding?: Partial<Pick<Branding, "primaryColor" | "secondaryColor">> | null;
}

/**
 * Builds the Cdorneles Mantine theme from design tokens. All values come from
 * `@cdorneles/tokens`; no hardcoded palette lives here.
 */
export function createAppTheme(options: CreateAppThemeOptions = {}): MantineThemeOverride {
  const primaryScale = options.branding?.primaryColor
    ? createColorScale(options.branding.primaryColor)
    : brand;

  const colors: Record<string, MantineColorsTuple> = {
    brand: primaryScale,
    gray,
    dark,
    success,
    warning,
    danger,
    info,
  };

  if (options.branding?.secondaryColor) {
    colors.secondary = createColorScale(options.branding.secondaryColor);
  }

  return createTheme({
    primaryColor: "brand",
    // Mantine 9 resolves the primary color at the fixed main shade (index 5) —
    // there is no index 10. Index 5 is `tokens.brand[5]`, keeping the rendered
    // UI aligned with the documented token and its AA contrast measurements.
    primaryShade: 5,
    // Filled buttons pick black/white text from the background luminance
    // (WCAG-friendlier than the hardcoded white default).
    autoContrast: true,
    colors,
    fontFamily: fontFamily.sans,
    fontFamilyMonospace: fontFamily.mono,
    fontSizes: mantineFontSizes,
    headings: {
      fontFamily: fontFamily.sans,
      fontWeight: String(fontWeights.semibold),
      sizes: {
        h1: { fontSize: "28px", lineHeight: String(lineHeights.tight) },
        h2: { fontSize: "22px", lineHeight: String(lineHeights.tight) },
        h3: { fontSize: "18px", lineHeight: String(lineHeights.normal) },
        h4: { fontSize: "16px", lineHeight: String(lineHeights.normal) },
        h5: { fontSize: "14px", lineHeight: String(lineHeights.normal) },
        h6: { fontSize: "13px", lineHeight: String(lineHeights.normal) },
      },
    },
    defaultRadius: "md",
    radius: mantineRadius,
    spacing: mantineSpacing,
    shadows: mantineShadows,
    breakpoints: mantineBreakpoints,
    other: {
      density,
      fontWeights,
      lineHeights,
      semanticColors,
    },
  });
}
