import { spacing } from "./spacing";

/**
 * Density presets. "default" is the platform baseline; compact/comfortable are
 * available for data-dense ERP screens without changing the token scale.
 */
export const density = {
  compact: {
    controlHeight: 32,
    controlPaddingX: spacing.sm,
    gap: spacing.xs,
    rowHeight: 36,
  },
  default: {
    controlHeight: 36,
    controlPaddingX: spacing.sm,
    gap: spacing.sm,
    rowHeight: 44,
  },
  comfortable: {
    controlHeight: 42,
    controlPaddingX: spacing.md,
    gap: spacing.md,
    rowHeight: 52,
  },
} as const;

export type Density = keyof typeof density;
