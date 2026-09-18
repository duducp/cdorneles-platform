import { createNoopProvider } from "./noop-provider";
import type { Observability, ObservabilityProvider } from "./types";

/** Builds a stable facade over a provider, decoupling callers from the impl. */
export function createObservability(provider: ObservabilityProvider): Observability {
  return {
    captureException: (error, context) => provider.captureException(error, context),
    captureMessage: (message, level, context) => provider.captureMessage(message, level, context),
    setUser: (user) => provider.setUser(user),
    setOrganization: (organization) => provider.setOrganization(organization),
    setContext: (key, context) => provider.setContext(key, context),
  };
}

let activeProvider: ObservabilityProvider = createNoopProvider();

/** Registers the provider used by the module-level default facade. */
export function setObservabilityProvider(provider: ObservabilityProvider): void {
  activeProvider = provider;
}

export function getObservabilityProvider(): ObservabilityProvider {
  return activeProvider;
}

const defaultObservability = createObservability({
  captureException: (error, context) => activeProvider.captureException(error, context),
  captureMessage: (message, level, context) =>
    activeProvider.captureMessage(message, level, context),
  setUser: (user) => activeProvider.setUser(user),
  setOrganization: (organization) => activeProvider.setOrganization(organization),
  setContext: (key, context) => activeProvider.setContext(key, context),
});

/** Module-level facade. Safe to call before a provider is configured. */
export const observability: Observability = defaultObservability;
