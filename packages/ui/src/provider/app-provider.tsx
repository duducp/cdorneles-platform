"use client";

import { ThemeProvider, type ThemeProviderProps } from "@cdorneles/theme";
import { QueryClientProvider, type QueryClient } from "@tanstack/react-query";
import type { ReactNode } from "react";

export interface AppProviderProps extends Omit<ThemeProviderProps, "children"> {
  queryClient: QueryClient;
  children: ReactNode;
}

/**
 * Shared application provider stack: server state (TanStack Query) plus the
 * platform theme. Keeps every app's root composition identical.
 */
export function AppProvider({ queryClient, children, ...themeProps }: AppProviderProps) {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider {...themeProps}>{children}</ThemeProvider>
    </QueryClientProvider>
  );
}
