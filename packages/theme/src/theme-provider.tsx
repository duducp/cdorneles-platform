"use client";

import type { ThemeMode } from "@cdorneles/types";
import { semanticColors } from "@cdorneles/tokens";
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
// to white in Light and `dark-7` (#242424) in Dark; wiring it to the semantic
// tokens gives Light its faint gray canvas and Dark the guide's #0C0C0C.
//
// Mantine's default `dimmed` (dark-2) fails AA on the dark body; use gray-4.
export const cssVariablesResolver: CSSVariablesResolver = () => ({
  variables: {},
  light: {
    "--mantine-color-body": semanticColors.light.background,
  },
  dark: {
    "--mantine-color-body": semanticColors.dark.background,
    "--mantine-color-dimmed": "var(--mantine-color-gray-4)",
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
