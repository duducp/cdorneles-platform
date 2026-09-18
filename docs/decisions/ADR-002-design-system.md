# ADR-002: Shared Design System

## Status

Accepted

## Decision

Create `@cdorneles/ui`, `@cdorneles/theme`, and `@cdorneles/tokens`.

Applications should consume shared UI through `@cdorneles/ui`.

Mantine remains the underlying component framework; `@cdorneles/ui` provides Cdorneles-specific wrappers, compositions, and patterns.

## Rules

- Reuse before creating.
- Tokens before hardcoded values.
- Light/Dark are mandatory.
- Responsive behavior is mandatory.
- Accessibility is mandatory.

## Consequences

The three applications remain visually and behaviorally consistent.
