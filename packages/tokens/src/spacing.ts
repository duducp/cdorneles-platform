/** Spacing scale in pixels. Consumed directly or through Mantine's spacing. */
export const spacing = {
  "3xs": 2,
  "2xs": 4,
  xs: 8,
  sm: 12,
  md: 16,
  lg: 24,
  xl: 32,
  "2xl": 48,
  "3xl": 64,
} as const;

export type SpacingToken = keyof typeof spacing;

export const mantineSpacing = {
  xs: `${spacing.xs}px`,
  sm: `${spacing.sm}px`,
  md: `${spacing.md}px`,
  lg: `${spacing.lg}px`,
  xl: `${spacing.xl}px`,
} as const;
