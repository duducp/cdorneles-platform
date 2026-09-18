export type SeverityLevel = "fatal" | "error" | "warning" | "log" | "info" | "debug";

export interface ObservabilityUser {
  id: string;
  email?: string | null;
  username?: string | null;
}

/** Organization identity for scoping events. Never include secrets. */
export interface ObservabilityOrganization {
  id: string;
  name?: string | null;
}

export type ObservabilityContext = Record<string, unknown>;

/**
 * Provider-agnostic observability contract (ADR-009). Sentry is the initial
 * provider but must be plugged in behind this interface, never used directly
 * from application code.
 */
export interface ObservabilityProvider {
  captureException(error: unknown, context?: ObservabilityContext): void;
  captureMessage(message: string, level?: SeverityLevel, context?: ObservabilityContext): void;
  setUser(user: ObservabilityUser | null): void;
  setOrganization(organization: ObservabilityOrganization | null): void;
  setContext(key: string, context: ObservabilityContext | null): void;
}

export type Observability = ObservabilityProvider;
