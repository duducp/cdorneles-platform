# ADR-009: Observability Strategy

## Status

Accepted

## Decision

Create `@cdorneles/observability` as the application-level observability abstraction.

Initial providers:

- Sentry for frontend errors/performance;
- Sentry for Function errors;
- Appwrite logs/executions for Function execution details;
- Prometheus/Grafana for infrastructure metrics.

Sentry Cloud Free is the initial deployment option.

OpenTelemetry is reserved for a later stage when distributed tracing provides enough value to justify the additional infrastructure.

Observability is separate from audit logging.

## Consequences

The platform gets useful diagnostics without prematurely operating a large observability stack. The provider remains replaceable.
