/**
 * Typography tokens. Default UI size is 14px (ARCHITECTURE §13).
 */
export const fontFamily = {
  sans: 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
  mono: '"JetBrains Mono", ui-monospace, SFMono-Regular, Menlo, Consolas, monospace',
} as const;

export const fontSizes = {
  xs: 12,
  sm: 13,
  md: 14,
  lg: 16,
  xl: 18,
  "2xl": 22,
  "3xl": 28,
} as const;

export type FontSizeToken = keyof typeof fontSizes;

export const lineHeights = {
  tight: 1.2,
  normal: 1.5,
  relaxed: 1.65,
} as const;

export const fontWeights = {
  regular: 400,
  medium: 500,
  semibold: 600,
  bold: 700,
} as const;

export const mantineFontSizes = {
  xs: `${fontSizes.xs}px`,
  sm: `${fontSizes.sm}px`,
  md: `${fontSizes.md}px`,
  lg: `${fontSizes.lg}px`,
  xl: `${fontSizes.xl}px`,
} as const;
