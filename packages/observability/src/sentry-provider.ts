import type {
  ObservabilityContext,
  ObservabilityOrganization,
  ObservabilityProvider,
  ObservabilityUser,
  SeverityLevel,
} from "./types";

const LEVEL_MAP: Record<SeverityLevel, string> = {
  fatal: "fatal",
  error: "error",
  warning: "warning",
  log: "log",
  info: "info",
  debug: "debug",
};

/** The slice of a Sentry scope this provider writes to. */
export interface SentryScope {
  setExtra(key: string, value: unknown): void;
}

/**
 * Minimal structural shape of the Sentry SDK this provider needs. Keeping it
 * structural lets the application own the `@sentry/nextjs` dependency and inject
 * the module, so `@cdorneles/observability` stays framework-agnostic.
 */
export interface SentryLike {
  captureException(error: unknown): void;
  /**
   * The second argument is the level/capture-context; it is typed `unknown` so
   * the real SDK's richer signature (`CaptureContext | SeverityLevel`) is
   * assignable. This provider always forwards the mapped severity string.
   */
  captureMessage(message: string, level?: unknown): void;
  setUser(user: unknown): void;
  setContext(key: string, context: unknown): void;
  withScope(callback: (scope: SentryScope) => void): void;
}

function applyContext(scope: SentryScope, context?: ObservabilityContext): void {
  if (context) {
    Object.entries(context).forEach(([key, value]) => {
      scope.setExtra(key, value);
    });
  }
}

/**
 * Creates a Sentry-backed observability provider from an injected SDK module.
 *
 * The application passes its initialized `@sentry/nextjs` module (see
 * `initObservability` in `@cdorneles/app`). When no SDK is injected the provider
 * logs to the console instead, so instrumentation calls never throw.
 */
export function createSentryProvider(sentry?: SentryLike | null): ObservabilityProvider {
  return {
    captureException(error: unknown, context?: ObservabilityContext) {
      if (sentry) {
        sentry.withScope((scope) => {
          applyContext(scope, context);
          sentry.captureException(error);
        });
      } else {
        console.error("[observability]", error, context);
      }
    },

    captureMessage(message: string, level: SeverityLevel = "log", context?: ObservabilityContext) {
      if (sentry) {
        sentry.withScope((scope) => {
          applyContext(scope, context);
          sentry.captureMessage(message, LEVEL_MAP[level]);
        });
      } else {
        console[level === "error" ? "error" : level === "warning" ? "warn" : "log"](
          `[observability] ${message}`,
          context,
        );
      }
    },

    setUser(user: ObservabilityUser | null) {
      sentry?.setUser(user);
    },

    setOrganization(organization: ObservabilityOrganization | null) {
      sentry?.setContext("organization", organization);
    },

    setContext(key: string, context: ObservabilityContext | null) {
      sentry?.setContext(key, context);
    },
  };
}
