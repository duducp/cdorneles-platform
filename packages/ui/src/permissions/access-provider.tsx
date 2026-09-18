"use client";

import {
  createAccessChecker,
  type AccessChecker,
  type GrantedAccess,
} from "@cdorneles/permissions";
import { createContext, useContext, useMemo, type ReactNode } from "react";

const AccessContext = createContext<AccessChecker | null>(null);

export interface AccessProviderProps {
  /** Granted capabilities for the active organization/application. */
  granted?: GrantedAccess;
  /** Pre-built checker (useful for tests or custom resolution). */
  checker?: AccessChecker;
  children: ReactNode;
}

/**
 * Provides the effective capabilities to the UI tree. This is a UX helper:
 * it never replaces server-side authorization (ARCHITECTURE §16).
 */
export function AccessProvider({ granted, checker, children }: AccessProviderProps) {
  const value = useMemo(
    () => checker ?? createAccessChecker(granted ?? { permissions: [], features: [] }),
    [checker, granted],
  );

  return <AccessContext.Provider value={value}>{children}</AccessContext.Provider>;
}

export function useAccess(): AccessChecker {
  const context = useContext(AccessContext);
  if (!context) {
    throw new Error("useAccess must be used within <AccessProvider>.");
  }
  return context;
}
