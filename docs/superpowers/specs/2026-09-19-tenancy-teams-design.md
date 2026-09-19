# Tenancy via Appwrite Teams — Design Spec

**Date:** 2026-09-19
**Status:** Approved
**Scope:** Resolve the authenticated user's organizations and roles from Appwrite Teams, and resolve the active organization from trusted context.

## Context

ADR-004: an Organization **is** an Appwrite Team; membership is the user-to-organization relationship. ADR-007: standard hosts identify the application, a custom host identifies the Organization. `docs/tenancy/README.md` states the rule this spec implements: *never trust an arbitrary client-provided organization ID as proof of authorization*.

The `@cdorneles/tenant` package already ships the contracts (`Organization`, `OrganizationMembership`, `isMemberOf`, `findMembership`), a presentational `TenantProvider`, and the pure `resolveDomain(host, config)`. What is missing is the service that turns Appwrite Teams into those contracts, and the rule that an organization id is only valid when the user actually holds a matching membership.

The auth chain is already proven end-to-end against the live project (`packages/auth/scripts/verify-auth.ts`). This work extends the same pattern to tenancy.

## Non-Goals

- Creating or managing organizations (Teams) — a later step; the probe only reads.
- Wiring `TenantProvider` into the apps / TanStack Query — deferred until an app has a login UI.
- Persisting the user's preferred organization — the resolver accepts a preference but does not store one.
- A login UI — still absent from every app.

## Service

```ts
export interface TenantService {
  listOrganizations(): Promise<Organization[]>;
  listMemberships(userId: string): Promise<OrganizationMembership[]>;
}

export function createAppwriteTenantService(teamsApi: TeamsApi): TenantService;
```

- `listOrganizations()` maps `teamsApi.listTeams()` to `{ id, name }`. The Appwrite Web SDK returns only the teams the current user belongs to.
- `listMemberships(userId)` calls `listTeams()`, then for each team `listMemberships(team.id)`, finds the membership whose `userId` matches, and returns `{ organizationId: team.id, roles }`. Team calls run in parallel via `Promise.all`. Teams without a membership for that user are omitted.

`userId` is a parameter rather than resolved internally, so the service stays pure and testable; callers already hold the user from the auth layer.

## Active organization resolution

```ts
export interface ResolveActiveOrganizationInput {
  organizations: readonly Organization[];
  memberships: readonly OrganizationMembership[];
  /** Organization implied by the trusted hostname (ADR-007). */
  domainOrganizationId?: string | null;
  /** The user's explicit preference. */
  preferredOrganizationId?: string | null;
}

export function resolveActiveOrganization(
  input: ResolveActiveOrganizationInput,
): Organization | null;
```

An organization id is honored **only when both hold**: it appears in `organizations`, and `isMemberOf(id, memberships)` is true. Ids failing either check are ignored and resolution falls through. The returned value is always the `Organization` object from `organizations`, never a synthesized one.

Precedence:

1. `domainOrganizationId`, if it is honored.
2. `preferredOrganizationId`, if it is honored.
3. The first organization in `organizations` that the user is a member of.
4. `null`.

This is the security-critical part: an organization id coming from the domain or the client never grants access on its own. A non-member id is ignored, and resolution falls through rather than trusting it.

## Probe

`packages/tenant/scripts/verify-tenant.ts`, following `packages/auth/scripts/verify-auth.ts`:

1. Load the root `.env` when present; shim `window.localStorage` (and `console`) so the Appwrite Web SDK works in Node.
2. Sign in as the test account (`E2E_EMAIL` / `E2E_PASSWORD`) through `services.account.createEmailPasswordSession` directly — the probe does not import `@cdorneles/auth`, so tenancy keeps no dependency on the auth package.
3. `listOrganizations()` and print them; assert at least one.
4. `listMemberships(userId)` and print the roles; assert one membership per organization with non-empty roles.
5. `resolveActiveOrganization` with the real organization id → returns it; with a non-member id → falls back rather than trusting it.

**Setup prerequisite:** a Team `e2e-org-probe` with `e2e-auth-probe` as a member, created out of band (Appwrite console/MCP). The probe reads only.

## Tests

- `packages/tenant/src/tenant-service.test.ts` — mocked `TeamsApi`: organization mapping, membership mapping, filtering by `userId`, parallel team calls, empty team list.
- `packages/tenant/src/active-organization.test.ts` — precedence order, and specifically that a domain/preferred id **without** membership is rejected.

## Files

| File | Change |
|---|---|
| `packages/tenant/src/tenant-service.ts` | **New** — `TenantService` + `createAppwriteTenantService` |
| `packages/tenant/src/active-organization.ts` | **New** — `resolveActiveOrganization` |
| `packages/tenant/src/index.ts` | Export the new modules |
| `packages/tenant/src/tenant-service.test.ts` | **New** — service tests |
| `packages/tenant/src/active-organization.test.ts` | **New** — resolver tests |
| `packages/tenant/scripts/verify-tenant.ts` | **New** — live probe |
| `packages/tenant/package.json` | Add `@cdorneles/api-client` dependency (for `TeamsApi`) |
| `packages/tenant/tsconfig.json` | Include `scripts` |

## Validation

- `pnpm lint` — 0 errors, 0 warnings
- `pnpm typecheck` — exit 0
- `pnpm test` — all pass
- `pnpm build` — exit 0
- Probe against the live project prints the resolved organizations, memberships and active organization, and passes.
