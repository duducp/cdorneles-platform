/**
 * End-to-end auth probe.
 *
 * Exercises the real `@cdorneles/auth` service against a live Appwrite project:
 * login -> getCurrentUser -> getSession -> logout -> confirm signed out.
 *
 * The Appwrite Web SDK persists sessions through `window.localStorage` and the
 * `X-Fallback-Cookies` header. We shim `localStorage` so the SDK also works in
 * Node, which is what makes this probe possible outside a browser.
 *
 * Usage:
 *   E2E_EMAIL=... E2E_PASSWORD=... pnpm exec tsx packages/auth/scripts/verify-auth.ts
 *
 * Endpoint and project ID are read from APPWRITE_* or NEXT_PUBLIC_APPWRITE_*
 * (the root `.env` is loaded when present). The API key is never needed here.
 */
import { existsSync } from "node:fs";
import { resolve } from "node:path";

import { createAppwriteServices, resolveApiClientConfig } from "@cdorneles/api-client";
import { createAppwriteAuthService } from "@cdorneles/auth";

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
  console.error(`[verify-auth] FAIL: ${message}`);
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
const auth = createAppwriteAuthService(services.account);

console.log(`[verify-auth] endpoint=${endpoint} project=${projectId}`);

const session = await auth.login({ email, password, turnstileToken: "test-token" });
console.log(`[verify-auth] 1. login ok -> session ${session.id} (user ${session.userId})`);

if (session.userId.length === 0) {
  fail("login returned an empty userId");
}

const user = await auth.getCurrentUser();
if (!user) {
  fail("getCurrentUser returned null right after login");
}
console.log(`[verify-auth] 2. getCurrentUser ok -> ${user.email} (id ${user.id})`);

if (user.email !== email) {
  fail(`getCurrentUser returned ${user.email}, expected ${email}`);
}

const current = await auth.getSession();
console.log(`[verify-auth] 3. getSession ok -> ${current ? current.id : "none"}`);

if (!current) {
  fail("getSession returned null right after login");
}

await auth.logout(session.id);
console.log("[verify-auth] 4. logout ok");

const stillSignedIn = await auth
  .getCurrentUser()
  .then(() => true)
  .catch(() => false);

if (stillSignedIn) {
  fail("getCurrentUser still succeeds after logout");
}

console.log("[verify-auth] 5. confirmed signed out after logout");
console.log("[verify-auth] PASS: auth chain verified end-to-end");
