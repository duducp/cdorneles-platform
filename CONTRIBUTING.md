# Contributing

## Development Principles

- Prefer simple, maintainable solutions.
- Reuse existing components and utilities.
- Keep business logic out of shared UI packages.
- Keep security decisions server-side.
- Preserve tenant isolation.
- Follow Conventional Commits.

## Before Coding

1. Read root `AGENTS.md`.
2. Read the closest nested `AGENTS.md`, if present.
3. Read relevant architecture documentation.
4. Search for existing implementations.
5. Search the design system before creating UI.

## Dependencies

New dependencies require explicit authorization.

When proposing a dependency, document:

- why it is necessary;
- why existing dependencies are insufficient;
- bundle/runtime impact when relevant;
- maintenance/security considerations.

## Commits

Use Conventional Commits:

```text
feat: add customer filters
fix: prevent cross-tenant access
refactor: extract table toolbar
docs: document domain routing
test: cover permission resolver
chore: update dependencies
```

Conventional Commits are also enforced locally by the `commit-msg` git hook
(commitlint). `pre-commit` formats/lints the staged files and `pre-push` runs
`pnpm typecheck`. Use `HUSKY=0` to bypass the hooks for a single command when
you have a reason to.
```

The type and scope are not cosmetic: release-please derives the version bump
and the changelog from them (see [Releases](./README.md#releases) in the
README). A `feat` produces a minor bump, a `fix` a patch, and a `!` or a
`BREAKING CHANGE:` footer a major one.

## Pull Requests

A PR should contain:

- concise problem statement;
- implementation summary;
- tests/validation;
- screenshots for meaningful UI changes;
- architectural notes when applicable.

## AI-assisted Development

AI agents are expected to follow `AGENTS.md`.

Agents may autonomously implement approved tasks, create commits, and prepare PRs.

Architectural changes require explicit approval before implementation.
