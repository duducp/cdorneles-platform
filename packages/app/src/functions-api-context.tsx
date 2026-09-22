"use client";

import type { FunctionsApi } from "@cdorneles/api-client";
import { createContext, useContext, type ReactNode } from "react";

const FunctionsApiContext = createContext<FunctionsApi | null>(null);

export interface FunctionsApiProviderProps {
  functionsApi: FunctionsApi;
  children: ReactNode;
}

/**
 * Exposes the Appwrite-backed `FunctionsApi` to the page tree. The provider is
 * mounted by `createProviders` only when an Appwrite config is present, so a
 * page that needs it fails loudly rather than silently calling into nothing.
 */
export function FunctionsApiProvider({ functionsApi, children }: FunctionsApiProviderProps) {
  return <FunctionsApiContext.Provider value={functionsApi}>{children}</FunctionsApiContext.Provider>;
}

export function useFunctionsApi(): FunctionsApi {
  const context = useContext(FunctionsApiContext);
  if (!context) {
    throw new Error("useFunctionsApi must be used within <FunctionsApiProvider>.");
  }
  return context;
}
