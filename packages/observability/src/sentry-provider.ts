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

/**
 * Creates a Sentry-backed observability provider. The `@sentry/nextjs`
 * package must be installed and initialized before calling this function.
 *
 * Falls back to console if Sentry is not available.
 */
export function createSentryProvider(): ObservabilityProvider {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let sentry: any = null;

  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    sentry = require("@sentry/nextjs");
  } catch {
    // Sentry not installed — fall back to console
  }

  return {
    captureException(error: unknown, context?: ObservabilityContext) {
      if (sentry) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        sentry.withScope((scope: any) => {
          if (context) {
            Object.entries(context).forEach(([key, value]) => {
              scope.setExtra(key, value);
            });
          }
          sentry.captureException(error);
        });
      } else {
        console.error("[observability]", error, context);
      }
    },

    captureMessage(message: string, level: SeverityLevel = "log", context?: ObservabilityContext) {
      if (sentry) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        sentry.withScope((scope: any) => {
          if (context) {
            Object.entries(context).forEach(([key, value]) => {
              scope.setExtra(key, value);
            });
          }
          sentry.captureMessage(message, LEVEL_MAP[level] as SeverityLevel);
        });
      } else {
        console[level === "error" ? "error" : level === "warning" ? "warn" : "log"](
          `[observability] ${message}`,
          context,
        );
      }
    },

    setUser(user: ObservabilityUser | null) {
      if (sentry) {
        sentry.setUser(user);
      }
    },

    setOrganization(organization: ObservabilityOrganization | null) {
      if (sentry) {
        sentry.setContext("organization", organization);
      }
    },

    setContext(key: string, context: ObservabilityContext | null) {
      if (sentry) {
        sentry.setContext(key, context);
      }
    },
  };
}
