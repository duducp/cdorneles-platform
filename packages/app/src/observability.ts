import {
  createNoopProvider,
  createSentryProvider,
  setObservabilityProvider,
  type SentryLike,
} from "@cdorneles/observability";

let initialized = false;

/**
 * Installs the observability provider. Uses Sentry when both a DSN and the
 * injected SDK are present, otherwise noop (ADR-009).
 *
 * The application owns the `@sentry/nextjs` dependency and passes the module in
 * (see each app's `providers.tsx`), keeping `@cdorneles/observability`
 * framework-agnostic.
 */
export function initObservability(sentry?: SentryLike | null): void {
  if (initialized) {
    return;
  }
  const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;
  setObservabilityProvider(dsn && sentry ? createSentryProvider(sentry) : createNoopProvider());
  initialized = true;
}
