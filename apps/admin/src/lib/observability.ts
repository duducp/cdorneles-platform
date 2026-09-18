import { createNoopProvider, setObservabilityProvider } from "@cdorneles/observability";

let initialized = false;

/**
 * Installs the noop observability provider. Replace with the Sentry adapter
 * once it is authorized and configured (ADR-009).
 */
export function initObservability(): void {
  if (initialized) {
    return;
  }
  setObservabilityProvider(createNoopProvider());
  initialized = true;
}
