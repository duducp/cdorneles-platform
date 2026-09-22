/**
 * End-to-end tenancy probe.
 *
 * Signs in against a live Appwrite project and verifies that organizations and
 * roles resolve from Appwrite Teams, and that the active organization is only
 * honored when a membership exists.
 *
 * Usage:
 *   E2E_EMAIL=... E2E_PASSWORD=... pnpm exec tsx packages/tenant/scripts/verify-tenant.ts
 *
 * Prerequisite: a team the test user belongs to (e.g. `e2e-org-probe`).
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
const projectId = process.env.APPWRITE_PROJECT_ID ?? process.env.NEXT_PUBLIC_APPWRITE_PROJECT_ID;
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
const tenant = createAppwriteTenantService(services.teams, services.functions);

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
