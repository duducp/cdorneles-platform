# First Appwrite Function — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship the first security-boundary Function — update an organization profile after validating the full effective-access chain and writing an audit record.

**Architecture:** A pure `authorize` module (the six deny-by-default conditions) is unit-tested against a mock. A thin Appwrite Function entrypoint (`index.ts`) implements the data access with `node-appwrite` (Teams + TablesDB), bundles to a single file with esbuild, and is deployed via the Appwrite MCP. A live probe exercises the happy path and two deny paths.

**Tech Stack:** TypeScript, node-appwrite, esbuild, vitest, Appwrite Functions (node-22), the Appwrite MCP for deployment.

---

## File Structure

| File | Responsibility |
|---|---|
| `functions/update-organization-profile/src/authorize.ts` | Pure effective-access decision |
| `functions/update-organization-profile/src/index.ts` | Appwrite Function entrypoint + `GrantRepo` impl |
| `functions/update-organization-profile/src/__tests__/authorize.test.ts` | Unit tests (mocked repo) |
| `functions/update-organization-profile/package.json` | node-appwrite dep + esbuild/vitest |
| `functions/update-organization-profile/tsconfig.json` | TypeScript config |
| `functions/update-organization-profile/.gitignore` | Ignore `dist/` |
| `pnpm-workspace.yaml` | Add `functions/*` |
| `packages/api-client/scripts/verify-function.ts` | Live probe |
| `packages/provisioning/src/config.ts` | `organization_profiles.active` + `white-label` feature |
| `packages/provisioning/src/__tests__/*.test.ts` | Updated table/seed tests |

---

### Task 1: Add functions to the workspace

**Files:**
- Modify: `pnpm-workspace.yaml`

- [ ] **Step 1: Add the workspace entry**

In `pnpm-workspace.yaml`, change the `packages` list:

```yaml
packages:
  - "apps/*"
  - "packages/*"
  - "functions/*"
```

- [ ] **Step 2: Install**

```bash
pnpm install
```

- [ ] **Step 3: Commit**

```bash
git add pnpm-workspace.yaml
git commit -m "chore: add functions to the pnpm workspace"
```

---

### Task 2: Scaffold the Function package

**Files:**
- Create: `functions/update-organization-profile/package.json`
- Create: `functions/update-organization-profile/tsconfig.json`
- Create: `functions/update-organization-profile/.gitignore`

- [ ] **Step 1: package.json**

```json
{
  "name": "@cdorneles/function-update-organization-profile",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "scripts": {
    "build": "esbuild src/index.ts --bundle --platform=node --format=esm --outfile=dist/index.js",
    "typecheck": "tsc --noEmit",
    "test": "vitest run"
  },
  "dependencies": {
    "node-appwrite": "^27.0.0"
  },
  "devDependencies": {
    "esbuild": "catalog:",
    "typescript": "catalog:",
    "vitest": "catalog:"
  }
}
```

- [ ] **Step 2: tsconfig.json**

```json
{
  "extends": "../../tsconfig.base.json",
  "include": ["src"],
  "compilerOptions": {
    "types": ["node"]
  }
}
```

- [ ] **Step 3: .gitignore**

```
dist/
node_modules/
```

- [ ] **Step 4: Install and verify the build tooling resolves**

```bash
pnpm install
pnpm --filter @cdorneles/function-update-organization-profile typecheck
```

Expected: `tsc --noEmit` with no errors (no source yet — it may report no inputs; that is fine).

- [ ] **Step 5: Commit**

```bash
git add functions/update-organization-profile/package.json functions/update-organization-profile/tsconfig.json functions/update-organization-profile/.gitignore
git commit -m "chore(function): scaffold update-organization-profile package"
```

---

### Task 3: Implement `authorize.ts` (TDD)

**Files:**
- Create: `functions/update-organization-profile/src/authorize.ts`
- Test: `functions/update-organization-profile/src/__tests__/authorize.test.ts`

- [ ] **Step 1: Write the failing test**

Create `functions/update-organization-profile/src/__tests__/authorize.test.ts`:

```ts
import { describe, expect, it, vi } from "vitest";

import { authorize, type GrantRepo } from "../authorize";

const memberships = vi.fn();
const listOrganizationRoles = vi.fn();
const listPermissionKeysForRoles = vi.fn();
const listApplicationIdsForRoles = vi.fn();
const getOrganizationProfile = vi.fn();
const isFeatureEnabled = vi.fn();

function createRepo(overrides: Partial<GrantRepo> = {}): GrantRepo {
  return {
    listMemberships: memberships,
    listOrganizationRoles,
    listPermissionKeysForRoles,
    listApplicationIdsForRoles,
    getOrganizationProfile,
    isFeatureEnabled,
    ...overrides,
  };
}

const input = {
  userId: "u1",
  organizationId: "org-1",
  applicationId: "admin",
  requiredPermission: "organizations.update",
  requiredFeature: "white-label",
};

const fullGrant = {
  memberships: [{ userId: "u1", roles: ["owner"] }],
  roles: [{ id: "role-owner", name: "owner" }],
  permissions: ["organizations.update"],
  applications: ["admin"],
  profile: { active: true },
  featureEnabled: true,
};

function seedAllGranted(repo: GrantRepo): void {
  vi.mocked(repo.listMemberships).mockResolvedValue(fullGrant.memberships);
  vi.mocked(repo.listOrganizationRoles).mockResolvedValue(fullGrant.roles);
  vi.mocked(repo.listPermissionKeysForRoles).mockResolvedValue(fullGrant.permissions);
  vi.mocked(repo.listApplicationIdsForRoles).mockResolvedValue(fullGrant.applications);
  vi.mocked(repo.getOrganizationProfile).mockResolvedValue(fullGrant.profile);
  vi.mocked(repo.isFeatureEnabled).mockResolvedValue(fullGrant.featureEnabled);
}

describe("authorize", () => {
  it("returns ok when every condition passes", async () => {
    const repo = createRepo();
    seedAllGranted(repo);

    await expect(authorize(input, repo)).resolves.toEqual({ ok: true, roles: ["owner"] });
  });

  it("denies an unauthenticated request (401)", async () => {
    const repo = createRepo();

    await expect(authorize({ ...input, userId: "" }, repo)).resolves.toEqual({
      ok: false,
      status: 401,
      reason: "not authenticated",
    });
  });

  it("denies a non-member (401)", async () => {
    const repo = createRepo();
    vi.mocked(repo.listMemberships).mockResolvedValue([
      { userId: "someone-else", roles: ["owner"] },
    ]);

    await expect(authorize(input, repo)).resolves.toEqual({
      ok: false,
      status: 401,
      reason: "not a member of the organization",
    });
  });

  it("denies an inactive organization (403)", async () => {
    const repo = createRepo();
    vi.mocked(repo.listMemberships).mockResolvedValue(fullGrant.memberships);
    vi.mocked(repo.getOrganizationProfile).mockResolvedValue(null);

    await expect(authorize(input, repo)).resolves.toEqual({
      ok: false,
      status: 403,
      reason: "organization is not active",
    });
  });

  it("denies when no role matches the membership (403)", async () => {
    const repo = createRepo();
    vi.mocked(repo.listMemberships).mockResolvedValue(fullGrant.memberships);
    vi.mocked(repo.getOrganizationProfile).mockResolvedValue(fullGrant.profile);
    vi.mocked(repo.listOrganizationRoles).mockResolvedValue([]);

    await expect(authorize(input, repo)).resolves.toEqual({
      ok: false,
      status: 403,
      reason: "no role grants access",
    });
  });

  it("denies when the application is not granted (403)", async () => {
    const repo = createRepo();
    vi.mocked(repo.listMemberships).mockResolvedValue(fullGrant.memberships);
    vi.mocked(repo.getOrganizationProfile).mockResolvedValue(fullGrant.profile);
    vi.mocked(repo.listOrganizationRoles).mockResolvedValue(fullGrant.roles);
    vi.mocked(repo.listApplicationIdsForRoles).mockResolvedValue(["customer"]);

    await expect(authorize(input, repo)).resolves.toEqual({
      ok: false,
      status: 403,
      reason: "missing application access: admin",
    });
  });

  it("denies when the permission is not granted (403)", async () => {
    const repo = createRepo();
    vi.mocked(repo.listMemberships).mockResolvedValue(fullGrant.memberships);
    vi.mocked(repo.getOrganizationProfile).mockResolvedValue(fullGrant.profile);
    vi.mocked(repo.listOrganizationRoles).mockResolvedValue(fullGrant.roles);
    vi.mocked(repo.listApplicationIdsForRoles).mockResolvedValue(fullGrant.applications);
    vi.mocked(repo.listPermissionKeysForRoles).mockResolvedValue([]);

    await expect(authorize(input, repo)).resolves.toEqual({
      ok: false,
      status: 403,
      reason: "missing permission: organizations.update",
    });
  });

  it("denies when the feature is disabled (403)", async () => {
    const repo = createRepo();
    vi.mocked(repo.listMemberships).mockResolvedValue(fullGrant.memberships);
    vi.mocked(repo.getOrganizationProfile).mockResolvedValue(fullGrant.profile);
    vi.mocked(repo.listOrganizationRoles).mockResolvedValue(fullGrant.roles);
    vi.mocked(repo.listApplicationIdsForRoles).mockResolvedValue(fullGrant.applications);
    vi.mocked(repo.listPermissionKeysForRoles).mockResolvedValue(fullGrant.permissions);
    vi.mocked(repo.isFeatureEnabled).mockResolvedValue(false);

    await expect(authorize(input, repo)).resolves.toEqual({
      ok: false,
      status: 403,
      reason: "missing feature: white-label",
    });
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

```bash
pnpm vitest run functions/update-organization-profile/src/__tests__/authorize.test.ts
```

Expected: FAIL — cannot resolve `../authorize`.

- [ ] **Step 3: Write the implementation**

Create `functions/update-organization-profile/src/authorize.ts`:

```ts
export interface AuthorizeInput {
  userId: string;
  organizationId: string;
  applicationId: string;
  requiredPermission: string;
  requiredFeature: string;
}

/** Data the authorization decision needs, satisfied by node-appwrite in the entrypoint. */
export interface GrantRepo {
  listMemberships(teamId: string): Promise<Array<{ userId: string; roles: string[] }>>;
  listOrganizationRoles(organizationId: string): Promise<Array<{ id: string; name: string }>>;
  listPermissionKeysForRoles(roleIds: readonly string[]): Promise<string[]>;
  listApplicationIdsForRoles(roleIds: readonly string[]): Promise<string[]>;
  getOrganizationProfile(organizationId: string): Promise<{ active: boolean } | null>;
  isFeatureEnabled(organizationId: string, featureKey: string): Promise<boolean>;
}

export type AuthorizeResult =
  | { ok: true; roles: string[] }
  | { ok: false; status: 401 | 403; reason: string };

/**
 * Effective access (ADR-005): authenticated AND membership AND organization
 * active AND application access AND permission AND feature enabled.
 * Deny-by-default; the first failing condition short-circuits.
 */
export async function authorize(input: AuthorizeInput, repo: GrantRepo): Promise<AuthorizeResult> {
  if (!input.userId) {
    return { ok: false, status: 401, reason: "not authenticated" };
  }

  const memberships = await repo.listMemberships(input.organizationId);
  const membership = memberships.find((member) => member.userId === input.userId);
  if (!membership) {
    return { ok: false, status: 401, reason: "not a member of the organization" };
  }

  const profile = await repo.getOrganizationProfile(input.organizationId);
  if (!profile || profile.active === false) {
    return { ok: false, status: 403, reason: "organization is not active" };
  }

  const roleRows = await repo.listOrganizationRoles(input.organizationId);
  const roleIds = roleRows
    .filter((role) => membership.roles.includes(role.name))
    .map((role) => role.id);
  if (roleIds.length === 0) {
    return { ok: false, status: 403, reason: "no role grants access" };
  }

  const applicationIds = await repo.listApplicationIdsForRoles(roleIds);
  if (!applicationIds.includes(input.applicationId)) {
    return { ok: false, status: 403, reason: `missing application access: ${input.applicationId}` };
  }

  const permissionKeys = await repo.listPermissionKeysForRoles(roleIds);
  if (!permissionKeys.includes(input.requiredPermission)) {
    return { ok: false, status: 403, reason: `missing permission: ${input.requiredPermission}` };
  }

  const featureEnabled = await repo.isFeatureEnabled(input.organizationId, input.requiredFeature);
  if (!featureEnabled) {
    return { ok: false, status: 403, reason: `missing feature: ${input.requiredFeature}` };
  }

  return { ok: true, roles: membership.roles };
}
```

- [ ] **Step 4: Run the test to verify it passes**

```bash
pnpm vitest run functions/update-organization-profile/src/__tests__/authorize.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add functions/update-organization-profile/src/authorize.ts functions/update-organization-profile/src/__tests__/authorize.test.ts
git commit -m "feat(function): add the effective-access authorize decision"
```

---

### Task 4: Implement the entrypoint

**Files:**
- Create: `functions/update-organization-profile/src/index.ts`

- [ ] **Step 1: Write the entrypoint**

Create `functions/update-organization-profile/src/index.ts`:

```ts
import { Client, ID, Query, TablesDB, Teams } from "node-appwrite";

import { authorize, type GrantRepo } from "./authorize";

const DATABASE_ID = "cdorneles_platform";

const client = new Client()
  .setEndpoint(process.env.APPWRITE_FUNCTION_API_ENDPOINT ?? "")
  .setProject(process.env.APPWRITE_FUNCTION_PROJECT_ID ?? "")
  .setKey(process.env.APPWRITE_FUNCTION_API_KEY ?? "");

const teams = new Teams(client);
const tables = new TablesDB(client);

const repo: GrantRepo = {
  async listMemberships(teamId) {
    const result = await teams.listMemberships(teamId);
    return result.memberships.map((membership) => ({
      userId: membership.userId,
      roles: membership.roles,
    }));
  },

  async listOrganizationRoles(organizationId) {
    const result = await tables.listRows(
      DATABASE_ID,
      "roles",
      [Query.equal("organizationId", organizationId)],
    );
    return result.rows.map((row) => ({
      id: row.$id,
      name: String(row.data.name ?? ""),
    }));
  },

  async listPermissionKeysForRoles(roleIds) {
    const keys = new Set<string>();
    for (const roleId of roleIds) {
      const result = await tables.listRows(
        DATABASE_ID,
        "role_permissions",
        [Query.equal("roleId", roleId)],
      );
      for (const row of result.rows) {
        const permission = await tables.getRow(
          DATABASE_ID,
          "permissions",
          String(row.data.permissionId),
        );
        keys.add(String(permission.data.key ?? ""));
      }
    }
    return [...keys];
  },

  async listApplicationIdsForRoles(roleIds) {
    const ids = new Set<string>();
    for (const roleId of roleIds) {
      const result = await tables.listRows(
        DATABASE_ID,
        "role_applications",
        [Query.equal("roleId", roleId)],
      );
      for (const row of result.rows) {
        const application = await tables.getRow(
          DATABASE_ID,
          "applications",
          String(row.data.applicationId),
        );
        ids.add(String(application.data.appId ?? ""));
      }
    }
    return [...ids];
  },

  async getOrganizationProfile(organizationId) {
    const result = await tables.listRows(
      DATABASE_ID,
      "organization_profiles",
      [Query.equal("organizationId", organizationId)],
    );
    const profile = result.rows[0];
    if (!profile) {
      return null;
    }
    return { active: profile.data.active !== false };
  },

  async isFeatureEnabled(organizationId, featureKey) {
    const features = await tables.listRows(
      DATABASE_ID,
      "features",
      [Query.equal("key", featureKey)],
    );
    const feature = features.rows[0];
    if (!feature) {
      return false;
    }
    const rows = await tables.listRows(
      DATABASE_ID,
      "organization_features",
      [Query.equal("organizationId", organizationId), Query.equal("featureId", feature.$id)],
    );
    const orgFeature = rows.rows[0];
    return orgFeature?.data.enabled === true;
  },
};

const PROFILE_FIELDS = [
  "displayName",
  "primaryColor",
  "secondaryColor",
  "logoLight",
  "logoDark",
  "favicon",
] as const;

interface Context {
  req: { body: string; headers: Record<string, string> };
  res: { json(value: unknown, status?: number): unknown };
  log: (message: unknown) => void;
}

export default async function ({ req, res, log }: Context) {
  let body: Record<string, unknown>;
  try {
    body = JSON.parse(req.body);
  } catch {
    return res.json({ error: "bad_request", reason: "invalid JSON" }, 400);
  }

  const userId = req.headers["x-appwrite-user-id"] ?? "";
  const organizationId = typeof body.organizationId === "string" ? body.organizationId : "";
  const applicationId = typeof body.applicationId === "string" ? body.applicationId : "";
  if (!organizationId || !applicationId) {
    return res.json({ error: "bad_request", reason: "organizationId and applicationId are required" }, 400);
  }

  const decision = await authorize(
    {
      userId,
      organizationId,
      applicationId,
      requiredPermission: "organizations.update",
      requiredFeature: "white-label",
    },
    repo,
  );

  if (!decision.ok) {
    log({ action: "organizations.update", decision });
    return res.json(
      { error: decision.status === 401 ? "unauthorized" : "forbidden", reason: decision.reason },
      decision.status,
    );
  }

  const changes: Record<string, unknown> = {};
  for (const field of PROFILE_FIELDS) {
    if (typeof body[field] === "string") {
      changes[field] = body[field];
    }
  }
  if (Object.keys(changes).length === 0) {
    return res.json({ error: "bad_request", reason: "no profile fields to update" }, 400);
  }

  const rows = await tables.listRows(
    DATABASE_ID,
    "organization_profiles",
    [Query.equal("organizationId", organizationId)],
  );
  const profileRow = rows.rows[0];
  if (!profileRow) {
    return res.json({ error: "forbidden", reason: "organization is not active" }, 403);
  }

  await tables.updateRow(DATABASE_ID, "organization_profiles", profileRow.$id, changes);

  await tables.createRow(DATABASE_ID, "audit_logs", ID.unique(), {
    userId,
    organizationId,
    action: "organizations.update",
    resourceType: "organization",
    resourceId: organizationId,
    metadata: JSON.stringify(changes),
    timestamp: new Date().toISOString(),
  });

  log({ action: "organizations.update", organizationId, userId, changed: Object.keys(changes) });

  return res.json({ ok: true });
}
```

- [ ] **Step 2: Typecheck**

```bash
pnpm --filter @cdorneles/function-update-organization-profile typecheck
```

Expected: exit 0. If `TablesDB`'s method names or `Query` usage differ in node-appwrite@27, adjust and report. If `getRow` does not exist, use `listRows` with `Query.equal("$id", ...)`.

- [ ] **Step 3: Build**

```bash
pnpm --filter @cdorneles/function-update-organization-profile build
```

Expected: `dist/index.js` produced. If esbuild cannot bundle node-appwrite/undici cleanly, switch the build to `--packages=external` and set the deploy `commands` to `"npm install"` (see Task 8).

- [ ] **Step 4: Commit**

```bash
git add functions/update-organization-profile/src/index.ts
git commit -m "feat(function): add the update-organization-profile entrypoint"
```

---

### Task 5: Add the `active` column and `white-label` feature to provisioning

**Files:**
- Modify: `packages/provisioning/src/config.ts`
- Test: `packages/provisioning/src/__tests__/database.test.ts`, `seeds.test.ts`

- [ ] **Step 1: Add the column**

In `packages/provisioning/src/config.ts`, in the `organization_profiles` table's `attributes`, add `active`:

```ts
{ key: "active", type: "boolean", required: true, default: true },
```

Add it after `defaultTheme`.

- [ ] **Step 2: Add the feature seed**

In `SEED_FEATURES`, add:

```ts
{ id: "feat_white_label", data: { key: "white-label", name: "White-label branding" } },
```

- [ ] **Step 3: Update the seed count test**

In `packages/provisioning/src/__tests__/seeds.test.ts`, the "inserts 7 features" test asserts 7; change to 8.

- [ ] **Step 4: Run tests**

```bash
pnpm vitest run packages/provisioning/src/__tests__/seeds.test.ts packages/provisioning/src/__tests__/database.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/provisioning/src/config.ts packages/provisioning/src/__tests__/seeds.test.ts
git commit -m "feat(provisioning): add organization_profiles.active and the white-label feature"
```

---

### Task 6: Re-run provisioning

- [ ] **Step 1: Run provision**

```bash
pnpm provision
```

Expected: adds the `active` column to `organization_profiles` and seeds `white-label` (idempotent skips for everything else).

---

### Task 7: Deploy the Function

- [ ] **Step 1: Create the function**

Via `functions_create` (Appwrite MCP) with:
- `function_id: "update-organization-profile"`
- `name: "Update Organization Profile"`
- `runtime: "node-22"`
- `execute: ["users"]`
- `scopes: ["teams.read", "tables.read", "columns.read", "rows.read", "rows.write"]`
- `entrypoint: "dist/index.js"`

- [ ] **Step 2: Deploy the bundle**

Via `functions_create_deployment` with the gzipped `dist/index.js` (entrypoint `dist/index.js`), `activate: true`.

- [ ] **Step 3: Confirm the deployment is ready**

Via `functions_list_deployments` (function_id `update-organization-profile`), confirm a deployment is `ready`/`active`.

---

### Task 8: Seed the test data

- [ ] **Step 1: Insert the role**

Via `tables_db` (Appwrite MCP), create a `roles` row:
- `id: "role_e2e_owner"`, `organizationId: "e2e-org-probe"`, `name: "owner"`

- [ ] **Step 2: Link role → permission**

Create a `role_permissions` row: `roleId: "role_e2e_owner"`, `permissionId: "perm_organizations_update"`.

- [ ] **Step 3: Link role → application**

Create a `role_applications` row: `roleId: "role_e2e_owner"`, `applicationId: "app_admin"`.

- [ ] **Step 4: Create the organization profile**

Create an `organization_profiles` row: `organizationId: "e2e-org-probe"`, `displayName: "E2E Org Probe"`, `active: true`.

- [ ] **Step 5: Enable the feature**

Create an `organization_features` row linking `e2e-org-probe` to the `white-label` feature with `enabled: true`.

---

### Task 9: Live probe

**Files:**
- Create: `packages/api-client/scripts/verify-function.ts`

- [ ] **Step 1: Write the probe**

Create `packages/api-client/scripts/verify-function.ts`, modelled on the auth/tenant probes (shim `localStorage`, load `.env`, sign in, then):

1. Happy path: `services.functions.createExecution({ functionId: "update-organization-profile", method: "POST", body: JSON.stringify({ organizationId: "e2e-org-probe", applicationId: "admin", displayName: "Acme Renamed" }) })` — assert `responseBody` parses to `{ ok: true }`.
2. Non-member: pass `organizationId: "not-a-member-org"` — assert status 401 / response contains `unauthorized`.
3. Missing permission: temporarily assert via a second user, or skip if a second user isn't available — assert 403 by calling with `applicationId: "customer"` (a member whose role has no `customer` app access) — assert `forbidden`.

- [ ] **Step 2: Run the probe**

```bash
E2E_EMAIL='e2e@cdorneles.test' E2E_PASSWORD='E2e!Probe-2026-x7Qm' pnpm exec tsx packages/api-client/scripts/verify-function.ts
```

Expected: all three paths print and `PASS`.

- [ ] **Step 3: Commit**

```bash
git add packages/api-client/scripts/verify-function.ts
git commit -m "test(api-client): add the update-organization-profile probe"
```

---

### Task 10: Verification gates

- [ ] **Step 1: Lint** — `pnpm lint`
- [ ] **Step 2: Typecheck** — `pnpm typecheck`
- [ ] **Step 3: Tests** — `pnpm test`
- [ ] **Step 4: Build** — `pnpm build`
- [ ] **Step 5: Commit any fixes** — only if there are changes

---

## Summary

| Task | Description | Status |
|---|---|---|
| 1 | Add functions to the workspace | TODO |
| 2 | Scaffold the Function package | TODO |
| 3 | `authorize.ts` (TDD) | TODO |
| 4 | `index.ts` entrypoint | TODO |
| 5 | Provisioning: `active` + `white-label` | TODO |
| 6 | Re-run provision | TODO |
| 7 | Deploy the Function | TODO |
| 8 | Seed test data | TODO |
| 9 | Live probe | TODO |
| 10 | Verification gates | TODO |
