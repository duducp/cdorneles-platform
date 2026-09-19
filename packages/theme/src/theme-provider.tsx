"use client";

import type { ThemeMode } from "@cdorneles/types";
import {
  localStorageColorSchemeManager,
  MantineProvider,
  useComputedColorScheme,
  useMantineColorScheme,
  type MantineColorSchemeManager,
} from "@mantine/core";
import { useMemo, type ReactNode } from "react";
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

const COLOR_SCHEME_STORAGE_KEY = "cdorneles-color-scheme";

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
