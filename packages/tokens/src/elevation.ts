/**
 * Minimal elevation scale. The visual direction favors low elevation and
 * avoids glassmorphism/decorative shadows (ARCHITECTURE §13).
 *
 * Shadows are color-scheme aware: the token values are CSS variable
 * references (`--cd-shadow-*`) that `cssVariablesResolver` in
 * `@cdorneles/theme` resolves per scheme from `elevationShadows`. Light casts
 * use the slate ink; dark casts follow GitHub's dark theme (Primer): the
 * near-black `rgba(1, 4, 9, …)` ink that stays visible over the slate canvas.
 */
const lightShadows = {
  xs: "0 1px 2px rgba(15, 23, 42, 0.06)",
  sm: "0 1px 3px rgba(15, 23, 42, 0.08), 0 1px 2px rgba(15, 23, 42, 0.04)",
  md: "0 4px 12px rgba(15, 23, 42, 0.08)",
  lg: "0 8px 24px rgba(15, 23, 42, 0.10)",
} as const;

const darkShadows = {
  xs: "0 1px 2px rgba(1, 4, 9, 0.32)",
  sm: "0 1px 3px rgba(1, 4, 9, 0.36), 0 1px 2px rgba(1, 4, 9, 0.24)",
  md: "0 4px 12px rgba(1, 4, 9, 0.40)",
  lg: "0 8px 24px rgba(1, 4, 9, 0.48)",
} as const;

export const elevationShadows = { light: lightShadows, dark: darkShadows } as const;

export const elevation = {
  none: "none",
  xs: "var(--cd-shadow-xs)",
  sm: "var(--cd-shadow-sm)",
  md: "var(--cd-shadow-md)",
  lg: "var(--cd-shadow-lg)",
} as const;

export type ElevationToken = keyof typeof elevation;

export const mantineShadows = {
  xs: elevation.xs,
  sm: elevation.sm,
  md: elevation.md,
  lg: elevation.lg,
  xl: elevation.lg,
} as const;
