# Tenancy via Appwrite Teams — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Resolve the authenticated user's organizations and roles from Appwrite Teams, and resolve the active organization from trusted context only.

**Architecture:** A `TenantService` wraps `TeamsApi` (list teams, then each team's memberships filtered by the user). A pure `resolveActiveOrganization` combines the domain-implied organization (ADR-007) and an optional preference, honoring an id only when a membership exists.

**Tech Stack:** TypeScript, Vitest, Appwrite Web SDK via `@cdorneles/api-client`, tsx for the live probe.

---

## File Structure

| File | Responsibility |
|---|---|
| `packages/tenant/src/tenant-service.ts` | `TenantService` + `createAppwriteTenantService` |
| `packages/tenant/src/active-organization.ts` | `resolveActiveOrganization` (pure) |
| `packages/tenant/src/index.ts` | Barrel exports |
| `packages/tenant/src/tenant-service.test.ts` | Service tests (mocked `TeamsApi`) |
| `packages/tenant/src/active-organization.test.ts` | Resolver tests |
| `packages/tenant/scripts/verify-tenant.ts` | Live probe |
| `packages/tenant/package.json` | Add `@cdorneles/api-client` dependency |
| `packages/tenant/tsconfig.json` | Include `scripts` |

---

### Task 1: Add the api-client dependency and include scripts

**Files:**
- Modify: `packages/tenant/package.json`
- Modify: `packages/tenant/tsconfig.json`

- [ ] **Step 1: Add the dependency**

In `packages/tenant/package.json`, add `@cdorneles/api-client` to `dependencies`:

```json
  "dependencies": {
    "@cdorneles/api-client": "workspace:*",
    "@cdorneles/types": "workspace:*"
  },
```

- [ ] **Step 2: Include `scripts` in typechecking**

In `packages/tenant/tsconfig.json`:

```json
{
  "extends": "../../tsconfig.base.json",
  "include": ["src", "scripts"]
}
```

- [ ] **Step 3: Install**

```bash
pnpm install
```

- [ ] **Step 4: Commit**

```bash
git add packages/tenant/package.json packages/tenant/tsconfig.json pnpm-lock.yaml
git commit -m "chore(tenant): depend on api-client and typecheck scripts"
```

---

### Task 2: Implement the tenant service (TDD)

**Files:**
- Create: `packages/tenant/src/tenant-service.ts`
- Test: `packages/tenant/src/tenant-service.test.ts`

- [ ] **Step 1: Write the failing test**

Create `packages/tenant/src/tenant-service.test.ts`:

```ts
import { describe, expect, it, vi } from "vitest";

import type { TeamsApi } from "@cdorneles/api-client";
import { createAppwriteTenantService } from "./tenant-service";

function createMockTeamsApi(): TeamsApi {
  return {
    listTeams: vi.fn(),
    listMemberships: vi.fn(),
  };
}

describe("createAppwriteTenantService", () => {
  it("is a function", () => {
    expect(typeof createAppwriteTenantService).toBe("function");
  });

  describe("listOrganizations", () => {
    it("maps teams to organizations", async () => {
      const api = createMockTeamsApi();
      vi.mocked(api.listTeams).mockResolvedValue([
        { $id: "org-1", name: "Acme" },
        { $id: "org-2", name: "Globex" },
      ]);

      const service = createAppwriteTenantService(api);

      await expect(service.listOrganizations()).resolves.toEqual([
        { id: "org-1", name: "Acme" },
        { id: "org-2", name: "Globex" },
      ]);
    });

    it("returns an empty list when the user has no teams", async () => {
      const api = createMockTeamsApi();
      vi.mocked(api.listTeams).mockResolvedValue([]);

      const service = createAppwriteTenantService(api);

      await expect(service.listOrganizations()).resolves.toEqual([]);
    });
  });

  describe("listMemberships", () => {
    it("returns roles for each team the user belongs to", async () => {
      const api = createMockTeamsApi();
      vi.mocked(api.listTeams).mockResolvedValue([
        { $id: "org-1", name: "Acme" },
        { $id: "org-2", name: "Globex" },
      ]);
      vi.mocked(api.listMemberships).mockImplementation(async (teamId: string) =>
        teamId === "org-1"
          ? [{ $id: "m1", teamId: "org-1", userId: "u1", roles: ["owner"] }]
          : [{ $id: "m2", teamId: "org-2", userId: "u2", roles: ["admin"] }],
      );

      const service = createAppwriteTenantService(api);

      await expect(service.listMemberships("u1")).resolves.toEqual([
        { organizationId: "org-1", roles: ["owner"] },
      ]);
    });

    it("queries memberships for every team", async () => {
      const api = createMockTeamsApi();
      vi.mocked(api.listTeams).mockResolvedValue([
        { $id: "org-1", name: "Acme" },
        { $id: "org-2", name: "Globex" },
      ]);
      vi.mocked(api.listMemberships).mockResolvedValue([]);

      const service = createAppwriteTenantService(api);
      await service.listMemberships("u1");

      expect(api.listMemberships).toHaveBeenCalledWith("org-1");
      expect(api.listMemberships).toHaveBeenCalledWith("org-2");
      expect(api.listMemberships).toHaveBeenCalledTimes(2);
    });

    it("omits teams where the user holds no membership", async () => {
      const api = createMockTeamsApi();
      vi.mocked(api.listTeams).mockResolvedValue([{ $id: "org-1", name: "Acme" }]);
      vi.mocked(api.listMemberships).mockResolvedValue([
        { $id: "m9", teamId: "org-1", userId: "someone-else", roles: ["owner"] },
      ]);

      const service = createAppwriteTenantService(api);

      await expect(service.listMemberships("u1")).resolves.toEqual([]);
    });
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

```bash
pnpm vitest run packages/tenant/src/tenant-service.test.ts
```

Expected: FAIL — cannot resolve `./tenant-service`.

- [ ] **Step 3: Write the implementation**

Create `packages/tenant/src/tenant-service.ts`:

```ts
import type { TeamsApi } from "@cdorneles/api-client";

import type { Organization, OrganizationMembership } from "./types";

/** Resolves the authenticated user's organizations from Appwrite Teams (ADR-004). */
export interface TenantService {
  listOrganizations(): Promise<Organization[]>;
  listMemberships(userId: string): Promise<OrganizationMembership[]>;
}

export function createAppwriteTenantService(teamsApi: TeamsApi): TenantService {
  return {
    async listOrganizations() {
      const teams = await teamsApi.listTeams();
      return teams.map((team) => ({ id: team.$id, name: team.name }));
    },

    async listMemberships(userId: string) {
      const teams = await teamsApi.listTeams();

      const memberships = await Promise.all(
        teams.map(async (team): Promise<OrganizationMembership | null> => {
          const rows = await teamsApi.listMemberships(team.id);
          const own = rows.find((row) => row.userId === userId);
          return own ? { organizationId: team.id, roles: own.roles } : null;
        }),
      );

      return memberships.filter(
        (membership): membership is OrganizationMembership => membership !== null,
      );
    },
  };
}
```

- [ ] **Step 4: Run the test to verify it passes**

```bash
pnpm vitest run packages/tenant/src/tenant-service.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/tenant/src/tenant-service.ts packages/tenant/src/tenant-service.test.ts
git commit -m "feat(tenant): resolve organizations and roles from Appwrite Teams"
```

---

### Task 3: Implement the active-organization resolver (TDD)

**Files:**
- Create: `packages/tenant/src/active-organization.ts`
- Test: `packages/tenant/src/active-organization.test.ts`

- [ ] **Step 1: Write the failing test**

Create `packages/tenant/src/active-organization.test.ts`:

```ts
import { describe, expect, it } from "vitest";

import { resolveActiveOrganization } from "./active-organization";
import type { Organization, OrganizationMembership } from "./types";

const orgA: Organization = { id: "org-a", name: "Org A" };
const orgB: Organization = { id: "org-b", name: "Org B" };

const membershipA: OrganizationMembership = { organizationId: "org-a", roles: ["owner"] };
const membershipB: OrganizationMembership = { organizationId: "org-b", roles: ["member"] };

describe("resolveActiveOrganization", () => {
  it("honors the domain organization when the user is a member", () => {
    expect(
      resolveActiveOrganization({
        organizations: [orgA, orgB],
        memberships: [membershipA, membershipB],
        domainOrganizationId: "org-b",
      }),
    ).toEqual(orgB);
  });

  it("ignores a domain organization the user is not a member of", () => {
    expect(
      resolveActiveOrganization({
        organizations: [orgA, orgB],
        memberships: [membershipA],
        domainOrganizationId: "org-b",
      }),
    ).toEqual(orgA);
  });

  it("honors the preferred organization when the user is a member", () => {
    expect(
      resolveActiveOrganization({
        organizations: [orgA, orgB],
        memberships: [membershipA, membershipB],
        preferredOrganizationId: "org-b",
      }),
    ).toEqual(orgB);
  });

  it("ignores a preferred organization the user is not a member of", () => {
    expect(
      resolveActiveOrganization({
        organizations: [orgA, orgB],
        memberships: [membershipA],
        preferredOrganizationId: "org-b",
      }),
    ).toEqual(orgA);
  });

  it("prefers the domain organization over the preferred one", () => {
    expect(
      resolveActiveOrganization({
        organizations: [orgA, orgB],
        memberships: [membershipA, membershipB],
        domainOrganizationId: "org-b",
        preferredOrganizationId: "org-a",
      }),
    ).toEqual(orgB);
  });

  it("ignores an id that has a membership but is not in the organization list", () => {
    expect(
      resolveActiveOrganization({
        organizations: [orgA],
        memberships: [membershipA, membershipB],
        domainOrganizationId: "org-b",
      }),
    ).toEqual(orgA);
  });

  it("falls back to the first organization the user belongs to", () => {
    expect(
      resolveActiveOrganization({
        organizations: [orgA, orgB],
        memberships: [membershipB],
      }),
    ).toEqual(orgB);
  });

  it("returns null when there are no organizations", () => {
    expect(
      resolveActiveOrganization({ organizations: [], memberships: [] }),
    ).toBeNull();
  });

  it("returns null when the user has no memberships", () => {
    expect(
      resolveActiveOrganization({ organizations: [orgA, orgB], memberships: [] }),
    ).toBeNull();
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

```bash
pnpm vitest run packages/tenant/src/active-organization.test.ts
```

Expected: FAIL — cannot resolve `./active-organization`.

- [ ] **Step 3: Write the implementation**

Create `packages/tenant/src/active-organization.ts`:

```ts
import { isMemberOf, type Organization, type OrganizationMembership } from "./types";

export interface ResolveActiveOrganizationInput {
  organizations: readonly Organization[];
  memberships: readonly OrganizationMembership[];
  /** Organization implied by the trusted hostname (ADR-007). */
  domainOrganizationId?: string | null;
  /** The user's explicit preference. */
  preferredOrganizationId?: string | null;
}

/**
 * Resolves the active organization from trusted context only.
 *
 * An id is honored only when it appears in `organizations` AND the user holds a
 * matching membership. Anything else is ignored, so a client- or
 * domain-supplied id can never grant access on its own (ADR-004).
 */
export function resolveActiveOrganization(
  input: ResolveActiveOrganizationInput,
): Organization | null {
  const { organizations, memberships, domainOrganizationId, preferredOrganizationId } = input;

  const honor = (organizationId: string | null | undefined): Organization | null => {
    if (!organizationId || !isMemberOf(organizationId, memberships)) {
      return null;
    }
    return organizations.find((organization) => organization.id === organizationId) ?? null;
  };

  return (
    honor(domainOrganizationId) ??
    honor(preferredOrganizationId) ??
    organizations.find((organization) => isMemberOf(organization.id, memberships)) ??
    null
  );
}
```

- [ ] **Step 4: Run the test to verify it passes**

```bash
pnpm vitest run packages/tenant/src/active-organization.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/tenant/src/active-organization.ts packages/tenant/src/active-organization.test.ts
git commit -m "feat(tenant): resolve the active organization from trusted context"
```

---

### Task 4: Export the new modules

**Files:**
- Modify: `packages/tenant/src/index.ts`

- [ ] **Step 1: Add the exports**

`packages/tenant/src/index.ts` currently re-exports `./domain`, `./tenant-context`, `./types`. Add the two new modules:

```ts
export * from "./domain";
export * from "./tenant-context";
export * from "./types";
export * from "./tenant-service";
export * from "./active-organization";
```

- [ ] **Step 2: Typecheck**

```bash
pnpm --filter @cdorneles/tenant typecheck
```

Expected: exit 0.

- [ ] **Step 3: Commit**

```bash
git add packages/tenant/src/index.ts
git commit -m "feat(tenant): export service and active-organization resolver"
```

---

### Task 5: Add the live probe

**Files:**
- Create: `packages/tenant/scripts/verify-tenant.ts`

- [ ] **Step 1: Create the probe**

Create `packages/tenant/scripts/verify-tenant.ts`, modelled on `packages/auth/scripts/verify-auth.ts`:

```ts
/**
 * End-to-end tenancy probe.
 *
 * Signs in against a live Appwrite project and verifies that organizations and
 * roles resolve from Appwrite Teams, and that the active organization is only
 * honored when a membership exists.
 *
 * Usage:
 *   E2E_EMAIL=... E2E_PASSWORD=... pnpm exec tsx packages/tenant/scripts/verify-tenant.ts
 */
import { existsSync } from "node:fs";
import { resolve } from "node:path";

import { createAppwriteServices, resolveApiClientConfig } from "@cdorneles/api-client";
import { createAppwriteTenantService, resolveActiveOrganization } from "@cdorneles/tenant";

function installLocalStorageShim(): void {
  const store = new Map<string, string>();
  const localStorage = {
    getItem: (key: string): string | null => store.get(key) ?? null,
    setItem: (key: string, value: string): void => {
      store.set(key, value);
    },
    removeItem: (key: string): void => {
      store.delete(key);
    },
    clear: (): void => {
      store.clear();
    },
    key: (index: number): string | null => [...store.keys()][index] ?? null,
    get length(): number {
      return store.size;
    },
  };

  Object.defineProperty(globalThis, "window", {
    value: { localStorage, console },
    configurable: true,
  });
  Object.defineProperty(globalThis, "localStorage", {
    value: localStorage,
    configurable: true,
  });
}

function fail(message: string): never {
  console.error(`[verify-tenant] FAIL: ${message}`);
  process.exit(1);
}

installLocalStorageShim();

const envFile = resolve(import.meta.dirname, "../../../.env");
if (existsSync(envFile)) {
  process.loadEnvFile(envFile);
}

const endpoint = process.env.APPWRITE_ENDPOINT ?? process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT;
const projectId =
  process.env.APPWRITE_PROJECT_ID ?? process.env.NEXT_PUBLIC_APPWRITE_PROJECT_ID;
const email = process.env.E2E_EMAIL;
const password = process.env.E2E_PASSWORD;

if (!endpoint || !projectId) {
  fail("missing Appwrite endpoint/project (APPWRITE_* or NEXT_PUBLIC_APPWRITE_*)");
}
if (!email || !password) {
  fail("set E2E_EMAIL and E2E_PASSWORD");
}

const config = resolveApiClientConfig({ endpoint, projectId });
const services = createAppwriteServices(config);
const tenant = createAppwriteTenantService(services.teams);

console.log(`[verify-tenant] endpoint=${endpoint} project=${projectId}`);

const session = await services.account.createEmailPasswordSession({ email, password });
console.log(`[verify-tenant] 1. signed in -> user ${session.userId}`);

const organizations = await tenant.listOrganizations();
console.log(
  `[verify-tenant] 2. listOrganizations -> ${
    organizations.map((organization) => `${organization.id} (${organization.name})`).join(", ") ||
    "none"
  }`,
);

if (organizations.length === 0) {
  fail("the test user belongs to no organization; create the e2e-org-probe team first");
}

const memberships = await tenant.listMemberships(session.userId);
console.log(
  `[verify-tenant] 3. listMemberships -> ${
    memberships
      .map((membership) => `${membership.organizationId}: ${membership.roles.join("/")}`)
      .join(", ") || "none"
  }`,
);

if (memberships.length !== organizations.length) {
  fail("expected one membership per organization");
}
if (memberships.some((membership) => membership.roles.length === 0)) {
  fail("found a membership with no roles");
}

const firstOrganization = organizations[0];
if (!firstOrganization) {
  fail("no organization to resolve");
}

const resolvedFromDomain = resolveActiveOrganization({
  organizations,
  memberships,
  domainOrganizationId: firstOrganization.id,
});
console.log(
  `[verify-tenant] 4. resolveActiveOrganization(domain=${firstOrganization.id}) -> ${
    resolvedFromDomain?.id ?? "null"
  }`,
);
if (resolvedFromDomain?.id !== firstOrganization.id) {
  fail("a domain organization the user belongs to was not honored");
}

const resolvedFromUnknown = resolveActiveOrganization({
  organizations,
  memberships,
  domainOrganizationId: "not-a-member-org",
});
console.log(
  `[verify-tenant] 5. resolveActiveOrganization(domain=not-a-member-org) -> ${
    resolvedFromUnknown?.id ?? "null"
  }`,
);
if (resolvedFromUnknown?.id === "not-a-member-org") {
  fail("a non-member organization id was trusted");
}

await services.account.deleteSession(session.$id);
console.log("[verify-tenant] 6. signed out");
console.log("[verify-tenant] PASS: tenancy resolution verified end-to-end");
```

- [ ] **Step 2: Typecheck**

```bash
pnpm --filter @cdorneles/tenant typecheck
```

Expected: exit 0.

- [ ] **Step 3: Commit**

```bash
git add packages/tenant/scripts/verify-tenant.ts
git commit -m "test(tenant): add live tenancy probe"
```

---

### Task 6: Set up the team and run the probe

- [ ] **Step 1: Create a Team with the test user as a member**

Create a Team `e2e-org-probe` named `E2E Org Probe` and add the user `e2e-auth-probe` (`e2e@cdorneles.test`) as a member with the `owner` role. This is done through the Appwrite console/MCP, outside the codebase.

- [ ] **Step 2: Run the probe**

```bash
E2E_EMAIL='e2e@cdorneles.test' E2E_PASSWORD='E2e!Probe-2026-x7Qm' pnpm exec tsx packages/tenant/scripts/verify-tenant.ts
```

Expected: prints the organization, the membership roles, the resolved active organization, and `PASS`.

---

### Task 7: Verification gates

- [ ] **Step 1: Lint**

```bash
pnpm lint
```

Expected: 0 errors, 0 warnings.

- [ ] **Step 2: Typecheck**

```bash
pnpm typecheck
```

Expected: exit 0.

- [ ] **Step 3: Tests**

```bash
pnpm test
```

Expected: all pass.

- [ ] **Step 4: Build**

```bash
pnpm build
```

Expected: exit 0.

- [ ] **Step 5: Commit any fixes**

```bash
git add -A
git commit -m "fix: address verification gate issues"
```

Only commit if there are changes.

---

## Summary

| Task | Description | Status |
|---|---|---|
| 1 | Add api-client dependency and include scripts | TODO |
| 2 | Implement the tenant service | TODO |
| 3 | Implement the active-organization resolver | TODO |
| 4 | Export the new modules | TODO |
| 5 | Add the live probe | TODO |
| 6 | Set up the team and run the probe | TODO |
| 7 | Verification gates | TODO |
