/**
 * Minimal elevation scale. The visual direction favors low elevation and
 * avoids glassmorphism/decorative shadows (ARCHITECTURE §13).
 */
export const elevation = {
  none: "none",
  xs: "0 1px 2px rgba(15, 23, 42, 0.06)",
  sm: "0 1px 3px rgba(15, 23, 42, 0.08), 0 1px 2px rgba(15, 23, 42, 0.04)",
  md: "0 4px 12px rgba(15, 23, 42, 0.08)",
  lg: "0 8px 24px rgba(15, 23, 42, 0.10)",
} as const;

export type ElevationToken = keyof typeof elevation;

export const mantineShadows = {
  xs: elevation.xs,
  sm: elevation.sm,
  md: elevation.md,
  lg: elevation.lg,
  xl: elevation.lg,
} as const;
