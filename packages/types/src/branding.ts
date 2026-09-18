import type { ThemeMode } from "./theme";

/**
 * White-label branding (ADR-006). This is a projection of organization
 * branding metadata; it does not duplicate Appwrite Teams.
 */
export interface Branding {
  displayName: string;
  logoLight?: string | null;
  logoDark?: string | null;
  favicon?: string | null;
  primaryColor?: string | null;
  secondaryColor?: string | null;
  defaultTheme: ThemeMode;
}
