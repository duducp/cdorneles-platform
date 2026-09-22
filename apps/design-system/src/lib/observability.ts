import { initObservability as init } from "@cdorneles/app/observability";
import * as Sentry from "@sentry/nextjs";

/**
 * Installs observability for the design-system playground, injecting the
 * `@sentry/nextjs` module the app owns (ADR-009).
 */
export function initObservability(): void {
  init(Sentry);
}
