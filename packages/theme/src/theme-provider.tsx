"use client";

import type { ThemeMode } from "@cdorneles/types";
import {
  localStorageColorSchemeManager,
  MantineProvider,
  useMantineColorScheme,
  type MantineColorSchemeManager,
} from "@mantine/core";
import { useMemo, type ReactNode } from "react";

import { createAppTheme, type CreateAppThemeOptions } from "./create-theme";

export interface ThemeProviderProps {
  children: ReactNode;
  /** Organization default theme. A user override (persisted) wins over it. */
  organizationDefault?: ThemeMode;
  branding?: CreateAppThemeOptions["branding"];
  /** Injectable for tests or alternative persistence. */
  colorSchemeManager?: MantineColorSchemeManager;
}

const COLOR_SCHEME_STORAGE_KEY = "cdorneles-color-scheme";

export function ThemeProvider({
  children,
  organizationDefault = "light",
  branding,
  colorSchemeManager,
}: ThemeProviderProps) {
  const theme = useMemo(() => createAppTheme({ branding }), [branding]);
  const manager = useMemo(
    () => colorSchemeManager ?? localStorageColorSchemeManager({ key: COLOR_SCHEME_STORAGE_KEY }),
    [colorSchemeManager],
  );

  return (
    <MantineProvider
      theme={theme}
      defaultColorScheme={organizationDefault}
      colorSchemeManager={manager}
    >
      {children}
    </MantineProvider>
  );
}

/** Theme-aware hook exposing the resolved Light/Dark mode and its controls. */
export function useAppColorScheme() {
  const { colorScheme, setColorScheme, toggleColorScheme, clearColorScheme } =
    useMantineColorScheme();
  return {
    colorScheme: colorScheme as ThemeMode,
    setColorScheme,
    toggleColorScheme,
    clearColorScheme,
  };
}
