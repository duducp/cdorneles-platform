# First Appwrite Function — Update Organization Profile — Design Spec

**Date:** 2026-09-19
**Status:** Approved
**Scope:** The first server-side security boundary: an Appwrite Function that updates an organization's profile after validating the full effective-access chain, and writes an audit record.

## Context

ADR-005 / ARCHITECTURE §6 and §16: Appwrite Functions are the security boundary for business operations; the effective access is `authenticated AND membership AND organization active AND application access AND permission AND feature enabled`, deny-by-default. Frontend checks are UX only.

The auth and tenancy chains are already proven against the live project (`packages/auth/scripts/verify-auth.ts`, `packages/tenant/scripts/verify-tenant.ts`). The database is provisioned (`roles`, `permissions`, `role_permissions`, `applications`, `role_applications`, `features`, `organization_features`, `organization_profiles`, `audit_logs`). This spec establishes the Function pattern every business module will repeat.

## Non-Goals

- Building a `customers`/`orders`/etc. module — this Function is the *pattern*, not a business feature.
- A login UI / `TenantProvider` wiring — still deferred.
- VCS-based deployments — deployment uses the Appwrite MCP (`functions_create` + `functions_create_deployment`), not the CLI or a git provider.
- Email, SMS, or any Messaging.

## Operation and contract

**Function ID:** `update-organization-profile`
**Runtime:** `node-22`
**Execute permission:** `["users"]` — any authenticated user may invoke; the real authorization is internal.

The client calls `FunctionsApi.createExecution({ functionId, method: "POST", body })` with:

```json
{
  "organizationId": "e2e-org-probe",
  "applicationId": "admin",
  "displayName": "Acme Ltda",
  "primaryColor": "#0f62fe",
  "secondaryColor": "#001d6c"
}
```

Only `organizationId` and `applicationId` are required; the other fields are the profile fields to update (any of `displayName`, `primaryColor`, `secondaryColor`, `logoLight`, `logoDark`, `favicon`).

Responses:
- `200 { ok: true }` on success.
- `401 { error: "unauthorized", reason: "<which condition failed>" }` when authentication or membership fails.
- `403 { error: "forbidden", reason: "<which condition failed>" }` when the organization is inactive, or application/permission/feature access fails.
- `400 { error: "bad_request", reason: "..." }` on malformed input.

## Authorization chain (server-side, deny-by-default)

The Function reads the authenticated user from `x-appwrite-user-id` (injected by Appwrite from the client's session) and validates, in order, returning `401`/`403` on the first failure:

1. **authenticated** — `x-appwrite-user-id` is present.
2. **membership** — the user is a member of the Team whose id equals `organizationId` (server `Teams` API).
3. **organization active** — an `organization_profiles` row exists for `organizationId` with `active !== false`.
4. **application access** — the user's roles grant access to `applicationId` via `role_applications`.
5. **permission** — the user's roles include `organizations.update` via `role_permissions`.
6. **feature enabled** — `organization_features` has `white-label` enabled for the organization.

If every condition passes, the Function updates the `organization_profiles` row and writes an `audit_logs` row (`action="organizations.update"`, `resourceType="organization"`, `resourceId=organizationId`, `metadata` = the changed fields, `timestamp` = now).

## Role mapping

The Appwrite Team membership role **name** equals `roles.name` (e.g. `"owner"`). The Function resolves the user's platform roles by finding `roles` rows where `name` is in `membership.roles` and `organizationId` matches, then joins `role_permissions` and `role_applications` by `roles.$id`. Authorization is always capability-based (`organizations.update`), never a role-name conditional.

## Schema and seed changes

Two changes, both applied via the existing idempotent provisioning:

1. `organization_profiles` gains `active` (boolean, required, default `true`) — the missing "organization active" model.
2. `SEED_FEATURES` gains `white-label` (key `white-label`, name `White-label branding`) — the feature that gates branding (ADR-006).

## Function structure

```
functions/update-organization-profile/
├── src/
│   ├── authorize.ts          # pure effective-access decision (the 6 conditions)
│   ├── index.ts              # Appwrite Function entrypoint (node-appwrite)
│   └── __tests__/
│       └── authorize.test.ts
├── package.json              # node-appwrite dependency
└── dist/index.js             # esbuild bundle (node-appwrite inlined) → deployed
```

`authorize.ts` holds all deny logic and is unit-testable without a network (node-appwrite services are injected/mocked, like the existing adapter tests mock the Web SDK). `index.ts` is the thin runtime adapter: parse `req`, call `authorize`, perform the write, respond.

The entrypoint uses the Appwrite Functions signature:

```ts
export default async ({ req, res, log }: {
  req: { body: string; headers: Record<string, string>; method: string };
  res: { json(obj: unknown, status?: number): unknown; empty(): unknown };
  log: (message: unknown) => void;
}) => {
  // ...
};
```

The user id comes from `req.headers["x-appwrite-user-id"]`.

The Function's server SDK client is configured from the runtime-injected environment: `APPWRITE_FUNCTION_API_ENDPOINT`, `APPWRITE_FUNCTION_PROJECT_ID`, `APPWRITE_FUNCTION_API_KEY`.

The `functions/*` directory is added to the pnpm workspace so esbuild, vitest and TypeScript resolve normally. `dist/` is gitignored and built at deploy time, not committed.

The Function is created with execution **scopes** covering what the auto-generated per-execution API key may do: `teams.read`, `tables.read`, `columns.read`, `rows.read`, `rows.write`.

## Deployment

Via the Appwrite MCP:
1. `functions_create` (id, name, runtime `node-22`, `execute: ["users"]`, scopes above, entrypoint `dist/index.js`).
2. `functions_create_deployment` with the gzipped esbuild bundle, `activate: true`.

## Test data (for the probe)

- Team `e2e-org-probe` (exists), user `e2e-auth-probe` member with role `owner` (exists).
- `roles` row: `{ id: "role_e2e_owner", organizationId: "e2e-org-probe", name: "owner" }`.
- `role_permissions`: `role_e2e_owner` → `perm_organizations_update`.
- `role_applications`: `role_e2e_owner` → `app_admin`.
- `organization_profiles`: a row for `e2e-org-probe` (`active: true`).
- `organization_features`: `white-label` enabled for `e2e-org-probe`.

This test data is inserted via the Appwrite MCP (server-side), documented in the plan, not committed as a code seed.

## Probe

`packages/api-client/scripts/verify-function.ts` signs in as `e2e-auth-probe` and executes the Function through `FunctionsApi.createExecution`. Asserts:

1. Happy path returns `ok` and the profile row changed.
2. A non-member organization returns `401`.
3. A member without `organizations.update` returns `403`.

## Tests

`authorize.test.ts` covers the pure decision: each of the six conditions independently failing, the ordering, and the all-pass case. The Function's thin adapter (`index.ts`) is not unit-tested; it is proven by the live probe.

## Files

| File | Change |
|---|---|
| `functions/update-organization-profile/src/authorize.ts` | **New** — pure authz decision |
| `functions/update-organization-profile/src/index.ts` | **New** — Function entrypoint |
| `functions/update-organization-profile/src/__tests__/authorize.test.ts` | **New** |
| `functions/update-organization-profile/package.json` | **New** — `node-appwrite` dep + esbuild/vitest |
| `functions/update-organization-profile/.gitignore` | **New** — ignore `dist/` |
| `pnpm-workspace.yaml` | Add `functions/*` to the workspace |
| `packages/api-client/scripts/verify-function.ts` | **New** — live probe |
| `packages/provisioning/src/config.ts` | `organization_profiles.active` + `white-label` feature |
| `packages/provisioning/src/__tests__/` | Update table/seed tests for the new column + feature |

## Validation

- `pnpm lint` — 0 errors, 0 warnings
- `pnpm typecheck` — exit 0
- `pnpm test` — all pass
- `pnpm build` — exit 0
- `pnpm provision` — re-run to apply the new column + feature (idempotent)
- Probe against the live project: happy path + both deny paths pass.
