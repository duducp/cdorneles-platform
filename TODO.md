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
      (`AccountApi`, `TeamsApi`, `TablesApi`, `FunctionsApi`, `StorageApi`).
- [x] Map Appwrite errors to `ApiError` (`toApiError`) with stable `code`s.
- [x] Keep the SDK out of app code: applications only use
      `createAppwriteApiClient`.
- [x] Unit tests with a mocked SDK; no live network in tests.
- [x] Expand `StorageApi` beyond preview URLs: upload, delete, list, download
      and view, with per-file `permissions` on upload.

### 2. Wire `@cdorneles/auth` to the adapter

- [x] Replace `createUnconfiguredAuthService()` with an Appwrite-backed
      `AuthService` (login, logout, session, current user).
- [ ] Implement MFA (`completeMfa`) and password recovery
      (`requestPasswordRecovery` / `confirmPasswordRecovery`) — still stubs
      that throw.
- [x] Session bootstrap/refresh in the app `Providers` (all four apps), with a
      graceful `createUnconfiguredAuthService()` fallback when env vars are
      absent.
- [ ] Prove it end-to-end in `apps/admin` (or `apps/design-system`) against a
      running Appwrite instance.

### 3. Provision the Appwrite backend

`pnpm provision` has been run against the live project. It now holds the
`cdorneles_platform` database with 10 tables, 3 applications, 24 permissions,
7 features and 3 storage buckets. Still 0 teams, 0 functions, 0 users.

- [x] Scaffold `@cdorneles/provisioning` with the database and the 10 tables
      from `ARCHITECTURE.md` §7 and their columns.
- [x] Seed the global `applications` registry (`admin`, `client`, `customer`)
      and the `permissions`/`features` definitions.
- [x] Idempotent provisioning (409-safe) behind a CLI (`pnpm provision`).
- [x] Provision the Storage buckets (`branding-logos`, `documents`, `avatars`).
- [x] Run `pnpm provision` against the live Appwrite project.
- [x] Migrate provisioning to the Appwrite 2.x `TablesDB` API
      (`createTable` / `create*Column` / `createRow`).
- [ ] Define table permissions and indexes (columns exist; permissions and
      indexes do not). Tables currently have `rowSecurity: false`.
- [ ] Record the schema in `docs/` and, if it changes architecture, an ADR.
- [ ] Rotate the API key: `project_list_keys` exposed its secret in a session
      transcript.

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
- [ ] Storage upload flow: an `@cdorneles/ui` upload component plus a
      `branding-logos` flow that writes per-file `read("team:<orgId>")`
      permissions and stores the resulting URL on `organization_profiles`.
- [ ] Transactional email via an Appwrite Function. The browser `appwrite`
      SDK has no `Messaging.createEmail` (it is server-side only), so email
      must be a Function invoked through `FunctionsApi.createExecution` — never
      a client-side Messaging API.
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
