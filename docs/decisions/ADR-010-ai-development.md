# ADR-010: AI-assisted Development Rules

## Status

Accepted

## Decision

AI agents have high autonomy for approved implementation work.

For non-trivial tasks they must:

1. read architecture instructions;
2. inspect existing code;
3. plan;
4. implement;
5. test;
6. self-review;
7. run lint;
8. run typecheck;
9. run tests;
10. build when applicable;
11. update documentation when needed;
12. report results.

Before creating UI, agents must search the existing design system.

New dependencies require user authorization.

Architectural changes require proposal and explicit approval before execution.

Agents may create commits and prepare PRs.

## Consequences

AI development remains fast while preserving architectural consistency and security.
