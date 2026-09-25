"use client";

import type { ThemeMode } from "@cdorneles/types";
import { elevationShadows, semanticColors } from "@cdorneles/tokens";
import {
  localStorageColorSchemeManager,
  MantineProvider,
  useComputedColorScheme,
  useMantineColorScheme,
  type CSSVariablesResolver,
  type MantineColorSchemeManager,
} from "@mantine/core";
import { useMemo, type ReactNode } from "react";
import { COLOR_SCHEME_STORAGE_KEY } from "./color-scheme";
import { createAppTheme, type CreateAppThemeOptions } from "./create-theme";

export interface ThemeProviderProps {
  children: ReactNode;
  organizationDefault?: ThemeMode;
  branding?: CreateAppThemeOptions["branding"];
  colorSchemeManager?: MantineColorSchemeManager;
  /**
   * Follow the OS/browser preference (`prefers-color-scheme`) on a first visit,
   * when no explicit choice is stored. Default `true`. Set `false` to force the
   * organization default instead.
   */
  respectSystemPreference?: boolean;
}

// `--mantine-color-body` is what actually paints the page. Mantine defaults it
// to white in Light and `dark-7` in Dark; wiring it to the semantic tokens
// gives Light its faint gray canvas and Dark GitHub's slate canvas (#0D1117).
//
// `--cd-surface` is the raised panel color (GitHub canvas vs card): pure white
// in Light and dark-6 #151B23 in Dark. Mantine's `Paper` paints itself with the
// body color, which would sink panels into the dark canvas; `createAppTheme`
// re-points Paper at this variable so auth cards, the data table and upload
// panels read as raised surfaces, matching our `Card`.
//
// Mantine's default `dimmed` (dark-2) fails AA on the dark body; use dark-3,
// GitHub's fgColor-muted (#9198A1, ≈6.4:1 on the canvas).
//
// `--cd-shadow-*` make elevation scheme-aware: Light uses the slate-ink casts,
// Dark GitHub's near-black Primer casts (see `elevationShadows`).
// `--mantine-color-error` is wired to the `danger` palette instead of
// Mantine's default red. `-light` variants stay default in Light but become
// translucent tints in Dark (GitHub bgColor-*-muted style) so subtle chips
// keep a lighter-than-canvas fill instead of a near-black block.
export const cssVariablesResolver: CSSVariablesResolver = () => ({
  variables: {
    "--cd-shadow-xs": elevationShadows.light.xs,
    "--cd-shadow-sm": elevationShadows.light.sm,
    "--cd-shadow-md": elevationShadows.light.md,
    "--cd-shadow-lg": elevationShadows.light.lg,
    "--cd-surface": semanticColors.light.surface,
    "--cd-surface-muted": semanticColors.light.surfaceMuted,
  },
  light: {
    "--mantine-color-body": semanticColors.light.background,
  },
  dark: {
    "--mantine-color-body": semanticColors.dark.background,
    "--mantine-color-dimmed": "var(--mantine-color-dark-3)",
    "--mantine-color-error": semanticColors.dark.error,
    // GitHub's overlay ink instead of Mantine's pure black scrim.
    "--overlay-bg": "rgba(1, 4, 9, 0.5)",
    "--cd-shadow-xs": elevationShadows.dark.xs,
    "--cd-shadow-sm": elevationShadows.dark.sm,
    "--cd-shadow-md": elevationShadows.dark.md,
    "--cd-shadow-lg": elevationShadows.dark.lg,
    "--cd-surface": semanticColors.dark.surface,
    "--cd-surface-muted": semanticColors.dark.surfaceMuted,
    "--mantine-color-brand-light": "var(--mantine-color-brand-8)",
    "--mantine-color-success-light": "var(--mantine-color-success-8)",
    "--mantine-color-warning-light": "var(--mantine-color-warning-8)",
    "--mantine-color-danger-light": "var(--mantine-color-danger-8)",
    "--mantine-color-info-light": "var(--mantine-color-info-8)",
    "--mantine-color-gray-light": "var(--mantine-color-gray-8)",
    "--mantine-color-gray-light-hover": "var(--mantine-color-gray-7)",
    "--mantine-color-gray-light-color": "var(--mantine-color-gray-2)",
  },
});

export function ThemeProvider({
  children,
  organizationDefault = "light",
  branding,
  colorSchemeManager,
  respectSystemPreference = true,
}: ThemeProviderProps) {
  const theme = useMemo(() => createAppTheme({ branding }), [branding]);
  const manager = useMemo(
    () => colorSchemeManager ?? localStorageColorSchemeManager({ key: COLOR_SCHEME_STORAGE_KEY }),
    [colorSchemeManager],
  );

  return (
    <MantineProvider
      theme={theme}
      defaultColorScheme={respectSystemPreference ? "auto" : organizationDefault}
      colorSchemeManager={manager}
      cssVariablesResolver={cssVariablesResolver}
    >
      {children}
    </MantineProvider>
  );
}

/**
 * Theme-aware hook exposing the resolved Light/Dark mode and its controls.
 * `colorScheme` is always the resolved `"light" | "dark"` (never `"auto"`).
 */
export function useAppColorScheme() {
  const { setColorScheme, toggleColorScheme, clearColorScheme } = useMantineColorScheme();
  const colorScheme = useComputedColorScheme("light", { getInitialValueInEffect: true });
  return { colorScheme, setColorScheme, toggleColorScheme, clearColorScheme };
}
