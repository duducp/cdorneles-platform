import type { ObservabilityProvider } from "./types";

/**
 * Safe default provider. Used until a real provider (Sentry) is configured so
 * that instrumentation calls never throw or require a dependency.
 */
export function createNoopProvider(): ObservabilityProvider {
  return {
    captureException: () => undefined,
    captureMessage: () => undefined,
    setUser: () => undefined,
    setOrganization: () => undefined,
    setContext: () => undefined,
  };
}
