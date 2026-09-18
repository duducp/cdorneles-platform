# ADR-003: Appwrite as Primary Backend

## Status

Accepted

## Decision

Use Appwrite 2 as the primary backend for:

- Authentication
- Teams
- Databases
- Functions
- Storage
- Messaging

No separate REST API layer is required initially.

`@cdorneles/api-client` abstracts Appwrite access.

## Consequences

The platform reduces backend infrastructure and uses Appwrite as the main application backend while retaining a stable application-level abstraction.
