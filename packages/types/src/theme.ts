/**
 * Only Light and Dark are exposed (ADR-006). There is intentionally no
 * `system` option.
 */
export type ThemeMode = "light" | "dark";

export const THEME_MODES = ["light", "dark"] as const;

export function isThemeMode(value: unknown): value is ThemeMode {
  return value === "light" || value === "dark";
}
