import {
  createNoopProvider,
  createSentryProvider,
  setObservabilityProvider,
} from "@cdorneles/observability";

let initialized = false;

/**
 * Installs the observability provider. Uses Sentry when SENTRY_DSN is set,
 * otherwise falls back to noop (ADR-009).
 */
export function initObservability(): void {
  if (initialized) {
    return;
  }
  const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;
  setObservabilityProvider(dsn ? createSentryProvider() : createNoopProvider());
  initialized = true;
}
