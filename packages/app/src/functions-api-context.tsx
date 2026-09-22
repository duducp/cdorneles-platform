"use client";

import type { FunctionsApi } from "@cdorneles/api-client";
import { createContext, useContext, type ReactNode } from "react";

/** Unique sentinel so a provided `null` is distinct from "no provider". */
const ABSENT = Symbol("functions-api-absent");

const FunctionsApiContext = createContext<FunctionsApi | null | typeof ABSENT>(ABSENT);

export interface FunctionsApiProviderProps {
  /** The api, or `null` when the deployment has no Appwrite config. */
  value: FunctionsApi | null;
  children: ReactNode;
}

/**
 * Exposes the Appwrite-backed `FunctionsApi` to the page tree. `createProviders`
 * mounts it in both branches: the real api when configured, `null` when the
 * deployment has no Appwrite config, so pages can render a graceful unconfigured
 * state. Using `useFunctionsApi` with no provider at all still fails loudly,
 * because that is a genuine wiring bug.
 */
export function FunctionsApiProvider({ value, children }: FunctionsApiProviderProps) {
  return <FunctionsApiContext.Provider value={value}>{children}</FunctionsApiContext.Provider>;
}

export function useFunctionsApi(): FunctionsApi | null {
  const context = useContext(FunctionsApiContext);
  if (context === ABSENT) {
    throw new Error("useFunctionsApi must be used within <FunctionsApiProvider>.");
  }
  return context;
}
