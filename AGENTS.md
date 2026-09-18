# AGENTS.md — Cdorneles Platform

## Purpose

This file defines mandatory engineering rules for AI agents working on the Cdorneles Platform monorepo.

## Architecture

- Frontend: Next.js + TypeScript.
- Package manager: pnpm.
- UI framework: Mantine.
- Icons: Lucide.
- Backend platform: Appwrite 2.
- Appwrite Authentication is the identity source of truth.
- Appwrite Team represents an Organization/tenant.
- Appwrite Functions are the security boundary for business operations.
- TanStack Query owns server state.
- Mantine Form owns form state.
- Zod owns validation schemas.
- Zustand is allowed only for genuinely client/global state.
- TanStack Table is used for complex data tables.
- Sentry is the initial observability provider behind `@cdorneles/observability`.

## Monorepo

```text
apps/
├── admin/
├── client/
├── customer/
└── design-system/

packages/
├── ui/
├── theme/
├── tokens/
├── auth/
├── tenant/
├── permissions/
├── api-client/
├── schemas/
├── types/
└── observability/
```

## UI Rules

- Applications should consume UI through `@cdorneles/ui`.
- Do not use Tailwind CSS.
- Do not use shadcn/ui.
- Do not create duplicate wrappers around existing `@cdorneles/ui` components.
- Before creating UI, search `@cdorneles/ui`, `@cdorneles/theme`, `@cdorneles/tokens`, and Mantine.
- Use design tokens instead of hardcoded colors, spacing, radius, typography, or elevation values.
- All interfaces must support mobile, tablet, desktop, and large desktop.
- Light and Dark themes are mandatory.
- Do not introduce a System theme option.
- Prefer accessible native/semantic behavior and keyboard navigation.
- Motion must be subtle and purposeful.

## Security

- Frontend authorization is UX only; never treat it as a security boundary.
- Appwrite Functions enforce business authorization.
- Never trust an arbitrary client-supplied `tenantId` as the source of tenant identity.
- Resolve organization context from the authenticated Appwrite user, Team membership, and trusted hostname/context.
- Every sensitive Function must validate authentication, membership, organization status, application access, permission, and required feature flags.
- Never log passwords, tokens, API keys, session secrets, or other credentials.
- Server/API keys must remain server-side.
- Tenant isolation is mandatory.
- Prefer deny-by-default authorization.
- Audit security-sensitive administrative actions.

## Authorization

Business permissions use stable `resource.action` keys, for example:

```text
customers.read
customers.create
customers.update
customers.delete
orders.read
orders.create
invoices.approve
```

- Roles select existing permissions.
- Organizations cannot invent new permission definitions.
- Roles and permissions must not be checked by role-name conditionals such as `if role === "admin"`.
- Check permissions/capabilities instead.
- Effective access is:

```text
authenticated
AND valid membership
AND active organization
AND application access
AND permission
AND feature enabled
```

## Dependencies

- A new dependency requires user authorization before installation.
- Prefer platform capabilities and existing dependencies.
- Do not introduce a library for functionality already covered by the stack.

## Architecture Changes

AI agents may propose architectural changes but must not execute them without explicit approval.

Examples:
- replacing Appwrite;
- replacing Mantine;
- changing tenancy model;
- changing authorization model;
- introducing a new global state framework;
- replacing the observability strategy;
- changing monorepo boundaries.

Small refactors necessary to complete an approved task are allowed.

## Development Workflow

For non-trivial tasks:

1. Read applicable `AGENTS.md` files.
2. Read relevant architecture/ADR documentation.
3. Search existing implementations.
4. Identify reusable components/utilities.
5. Produce a concise implementation plan.
6. Implement.
7. Add/update tests.
8. Run self-review.
9. Run lint.
10. Run typecheck.
11. Run tests.
12. Run build when applicable.
13. Update documentation when architecture/patterns changed.
14. Report what changed and validation results.

## Self-review Checklist

Before considering a task complete, review:

- Architecture
- Types
- Security
- Authorization
- Tenant isolation
- Responsive behavior
- Light/Dark behavior
- Accessibility
- Tests
- Lint
- Typecheck
- Build
- Documentation

## Scope

Keep the requested scope. Small related improvements are allowed when they are necessary, low-risk, and clearly reported.

## Git

- Use Conventional Commits.
- Agents may create commits automatically.
- Agents may prepare complete PRs automatically.
- Never commit secrets.
- Never bypass validation merely to make CI pass.

## Core Principle

> Reuse first. Extend second. Create new only when necessary.

Prefer simplicity and maintainability over maximal abstraction.
