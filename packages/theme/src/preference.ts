import type { ThemeMode } from "@cdorneles/types";

/**
 * Theme resolution model (ADR-006): an organization default that a user can
 * override. Persistence of the user override is handled by the color-scheme
 * manager in `ThemeProvider`; it is intentionally not a concern of this type.
 */
export interface ThemePreference {
  organizationDefault: ThemeMode;
  userOverride?: ThemeMode | null;
}

export function resolveThemeMode(preference: ThemePreference): ThemeMode {
  return preference.userOverride ?? preference.organizationDefault;
}

export function createThemePreference(input: Partial<ThemePreference> = {}): ThemePreference {
  return {
    organizationDefault: input.organizationDefault ?? "light",
    userOverride: input.userOverride ?? null,
  };
}
