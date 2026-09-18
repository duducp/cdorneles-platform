/** Border radius scale in pixels. */
export const radius = {
  none: 0,
  xs: 2,
  sm: 4,
  md: 6,
  lg: 8,
  xl: 12,
  pill: 999,
} as const;

export type RadiusToken = keyof typeof radius;

export const mantineRadius = {
  xs: `${radius.xs}px`,
  sm: `${radius.sm}px`,
  md: `${radius.md}px`,
  lg: `${radius.lg}px`,
  xl: `${radius.xl}px`,
} as const;
