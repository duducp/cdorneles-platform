# TODO — Cdorneles Platform

Living backlog for the platform. Keep it ordered, small and honest: an item is
done only when it satisfies [`DEFINITION_OF_DONE.md`](./DEFINITION_OF_DONE.md).

The **Foundation** (monorepo, tooling, design system, package contracts) is in
place. The next phase is turning those contracts into real, Appwrite-backed
capabilities. No business modules yet.

## Now — Foundation → first vertical slice

### 1. Appwrite SDK adapter (`@cdorneles/api-client`)

- [x] Authorize and add the `appwrite` SDK to the pnpm `catalog`
      (`pnpm-workspace.yaml`) and to `@cdorneles/api-client` dependencies.
- [x] Implement the concrete adapter behind the existing interfaces
      (`AccountApi`, `TeamsApi`, `DatabasesApi`, `FunctionsApi`, `StorageApi`).
- [x] Map Appwrite errors to `ApiError` (`toApiError`) with stable `code`s.
- [x] Keep the SDK out of app code: applications only ever use `createApiClient`.
- [x] Unit tests with a mocked SDK; no live network in tests.

### 2. Wire `@cdorneles/auth` to the adapter

- [ ] Replace `createUnconfiguredAuthService()` with an Appwrite-backed
      `AuthService` (login, logout, session, current user, MFA, recovery).
- [ ] Session bootstrap/refresh in the app `Providers`.
- [ ] Prove it end-to-end in `apps/admin` (or `apps/design-system`).

### 3. Provision the Appwrite backend

Project is currently empty (0 databases, 0 teams, 0 functions, 0 users).

- [ ] Create the database and collections from `ARCHITECTURE.md` §7:
      `organization_profiles`, `roles`, `permissions`, `role_permissions`,
      `applications`, `role_applications`, `features`, `organization_features`,
      `domains`, `audit_logs`.
- [ ] Define collection permissions/attributes and indexes.
- [ ] Seed the global `applications` registry (`admin`, `client`, `customer`)
      and the `permissions`/`features` definitions.
- [ ] Record the schema in `docs/` and, if it changes architecture, an ADR.

### 4. Tenancy and domain resolution

- [ ] Wire `@cdorneles/tenant` to real Team memberships via the adapter.
- [ ] Resolve organization context from authenticated user + membership +
      trusted hostname (`resolveDomain`) — never from client input.
- [ ] Document standard vs. custom domain behaviour (ADR-007).

### 5. First Appwrite Function (security boundary)

- [ ] Implement one sensitive operation end-to-end as a Function that validates
      auth, membership, active organization, application access, permission and
      feature flags (deny-by-default).
- [ ] Emit an audit-log record for the administrative action.

## Next

- [ ] `@cdorneles/observability`: real Sentry provider behind the existing
      contract (browser + Functions).
- [ ] `@cdorneles/permissions`: load real grants and feed `AccessProvider`
      instead of the empty placeholder in `apps/*/providers.tsx`.
- [ ] White-label branding: apply `organization_profiles` branding to
      `@cdorneles/theme` (contrast-validated tokens).
- [ ] CI: confirm `install → lint → typecheck → test → build` stays green on
      every change.

## Later — business modules (only after the above)

- [ ] `customers` · `orders` · `invoices` · `products` · `inventory` ·
      `financial` · `sales`.

## Done

- [x] Monorepo bootstrap: pnpm workspaces, TypeScript, ESLint, Prettier,
      Vitest, shared `tooling/`.
- [x] Four apps scaffolded (`admin`, `client`, `customer`, `design-system`).
- [x] Ten shared packages with contracts and tests.
- [x] Design system foundation: tokens, theme (light/dark), `@cdorneles/ui`.
- [x] Architecture docs and ADR-001…ADR-010.
- [x] Project-scoped Appwrite MCP configuration and `.env` wiring.

## Conventions

- New dependency ⇒ explicit user authorization first (`AGENTS.md`).
- Architecture change ⇒ ADR + approval before implementation.
- Update this file as items land; do not let it drift from reality.
