/**
 * End-to-end probe for the `update-organization-profile` Function.
 *
 * Signs in against the live Appwrite project and exercises the security
 * boundary through the real `@cdorneles/api-client` FunctionsApi: the happy
 * path plus two deny paths (non-member, missing application access).
 *
 * Usage:
 *   E2E_EMAIL=... E2E_PASSWORD=... pnpm exec tsx packages/api-client/scripts/verify-function.ts
 *
 * Prerequisites (seeded for `e2e-org-probe`):
 *   - the test user is a member of the team with the `owner` role;
 *   - `roles`, `role_permissions` (organizations.update), `role_applications`
 *     (admin), `organization_profiles` (active) and `organization_features`
 *     (white-label) rows exist;
 *   - an existing team the user is NOT a member of (`e2e-org-other`).
 *
 * Endpoint and project ID are read from APPWRITE_* or NEXT_PUBLIC_APPWRITE_*
 * (the root `.env` is loaded when present). The API key is never needed here.
 */
import { existsSync } from "node:fs";
import { resolve } from "node:path";

import { createAppwriteServices, resolveApiClientConfig } from "@cdorneles/api-client";

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
  console.error(`[verify-function] FAIL: ${message}`);
  process.exit(1);
}

function parseBody(body: string): Record<string, unknown> {
  try {
    return JSON.parse(body) as Record<string, unknown>;
  } catch {
    return {};
  }
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

const FUNCTION_ID = "update-organization-profile";
const ORGANIZATION_ID = "e2e-org-probe";
const NON_MEMBER_ORGANIZATION_ID = "e2e-org-other";

const config = resolveApiClientConfig({ endpoint, projectId });
const services = createAppwriteServices(config);

console.log(`[verify-function] endpoint=${endpoint} project=${projectId}`);

const session = await services.account.createEmailPasswordSession({ email, password });
console.log(`[verify-function] 1. signed in -> user ${session.userId}`);

const happy = await services.functions.createExecution({
  functionId: FUNCTION_ID,
  method: "POST",
  body: JSON.stringify({
    organizationId: ORGANIZATION_ID,
    applicationId: "admin",
    displayName: "Acme Renamed",
  }),
});
const happyBody = parseBody(happy.responseBody);
console.log(`[verify-function] 2. happy path -> ${happy.responseBody}`);
if (happyBody.ok !== true) {
  fail(`happy path did not return { ok: true }: ${happy.responseBody}`);
}

const nonMember = await services.functions.createExecution({
  functionId: FUNCTION_ID,
  method: "POST",
  body: JSON.stringify({
    organizationId: NON_MEMBER_ORGANIZATION_ID,
    applicationId: "admin",
    displayName: "Should Not Apply",
  }),
});
const nonMemberBody = parseBody(nonMember.responseBody);
console.log(`[verify-function] 3. non-member -> ${nonMember.responseBody}`);
if (
  nonMemberBody.error !== "forbidden" ||
  nonMemberBody.reason !== "not a member of the organization"
) {
  fail(`non-member did not fail closed as forbidden: ${nonMember.responseBody}`);
}

const missingApp = await services.functions.createExecution({
  functionId: FUNCTION_ID,
  method: "POST",
  body: JSON.stringify({
    organizationId: ORGANIZATION_ID,
    applicationId: "customer",
    displayName: "Should Not Apply",
  }),
});
const missingAppBody = parseBody(missingApp.responseBody);
console.log(`[verify-function] 4. missing application access -> ${missingApp.responseBody}`);
if (missingAppBody.error !== "forbidden") {
  fail(`missing application did not return forbidden: ${missingApp.responseBody}`);
}

await services.account.deleteSession(session.$id);
console.log("[verify-function] 5. signed out");
console.log("[verify-function] PASS: security boundary verified end-to-end");
