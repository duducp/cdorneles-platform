# Appwrite Auth Service — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace `createUnconfiguredAuthService()` with a real `createAppwriteAuthService()` backed by the existing `AccountApi`.

**Architecture:** A single factory function receives `AccountApi` and returns `AuthService`. Four methods are real (login, logout, getSession, getCurrentUser); three are deferred stubs (MFA, recovery). The `AppwriteAccount` DTO is extended with `emailVerification` and `mfa` so the auth service can map the full `AuthUser`.

**Tech Stack:** TypeScript, `@cdorneles/api-client` (AccountApi), `@cdorneles/auth` (AuthService), Vitest

---

## File Structure

```text
packages/api-client/src/
  dto.ts                          # Modify — extend AppwriteAccount with emailVerification, mfa
  adapters/account.ts             # Verify getCurrentUser returns full user (no change needed)

packages/auth/src/
  appwrite-auth-service.ts        # New — createAppwriteAuthService factory
  appwrite-auth-service.test.ts   # New — ~13 tests
  index.ts                        # Modify — add export

packages/auth/
  package.json                    # Modify — add @cdorneles/api-client dependency

apps/admin/src/app/providers.tsx  # Modify — wire real auth service
apps/client/src/app/providers.tsx # Modify — wire real auth service
apps/customer/src/app/providers.tsx # Modify — wire real auth service
apps/design-system/src/app/providers.tsx # Modify — wire real auth service
```

---

### Task 1: Extend AppwriteAccount DTO and export resolveApiClientConfig

**Files:**
- Modify: `packages/api-client/src/dto.ts:10-15`
- Modify: `packages/api-client/src/index.ts`

The `AppwriteAccount` DTO is missing `emailVerification` and `mfa` fields that the auth service needs. The SDK's `User` model has both (`emailVerification: boolean`, `mfa: boolean`). The adapter already maps the full SDK user — we just need the DTO to carry those fields.

Additionally, `resolveApiClientConfig` needs to be exported from the barrel so apps can use it to build the config.

- [ ] **Step 1: Extend AppwriteAccount**

```ts
export interface AppwriteAccount {
  $id: string;
  email: string;
  name: string;
  status: boolean;
  emailVerification: boolean;
  mfa: boolean;
}
```

- [ ] **Step 2: Export resolveApiClientConfig from barrel**

In `packages/api-client/src/index.ts`, add:

```ts
export { resolveApiClientConfig } from "./config";
export type { ApiClientConfig, ApiClientConfigInput } from "./config";
```

- [ ] **Step 3: Verify adapter still compiles**

Run: `pnpm --filter @cdorneles/api-client typecheck`
Expected: exit 0 (adapter already returns full SDK user, TypeScript infers the new fields)

- [ ] **Step 4: Run api-client tests**

Run: `pnpm vitest run packages/api-client`
Expected: all 85 tests pass (no behavioral change)

- [ ] **Step 5: Commit**

```bash
git add packages/api-client/src/dto.ts packages/api-client/src/index.ts
git commit -m "fix(api-client): extend AppwriteAccount DTO and export resolveApiClientConfig"
```

---

### Task 2: Add @cdorneles/api-client dependency to @cdorneles/auth

**Files:**
- Modify: `packages/auth/package.json`

- [ ] **Step 1: Add workspace dependency**

In `packages/auth/package.json`, add to `"dependencies"`:

```json
{
  "dependencies": {
    "@cdorneles/api-client": "workspace:*",
    "@cdorneles/types": "workspace:*"
  }
}
```

- [ ] **Step 2: Install**

Run: `pnpm install`
Expected: lockfile updated, no errors

- [ ] **Step 3: Verify typecheck**

Run: `pnpm --filter @cdorneles/auth typecheck`
Expected: exit 0

- [ ] **Step 4: Commit**

```bash
git add packages/auth/package.json pnpm-lock.yaml
git commit -m "chore(auth): add @cdorneles/api-client dependency"
```

---

### Task 3: Implement createAppwriteAuthService — login

**Files:**
- Create: `packages/auth/src/appwrite-auth-service.ts`

- [ ] **Step 1: Create the file with login implementation**

```ts
import type { AccountApi } from "@cdorneles/api-client";
import type { AuthService, AuthSession, AuthUser } from "./types";

function mapSession(raw: { $id: string; userId: string; expire: string }): AuthSession {
  return { id: raw.$id, userId: raw.userId, expiresAt: raw.expire };
}

function mapUser(raw: {
  $id: string;
  email: string;
  name: string;
  emailVerification: boolean;
  mfa: boolean;
}): AuthUser {
  return {
    id: raw.$id,
    email: raw.email,
    name: raw.name,
    emailVerified: raw.emailVerification,
    mfaEnabled: raw.mfa,
  };
}

export function createAppwriteAuthService(accountApi: AccountApi): AuthService {
  return {
    async login(input) {
      const session = await accountApi.createEmailPasswordSession(input);
      return mapSession(session);
    },

    async completeMfa() {
      throw new Error("MFA not implemented yet");
    },

    async logout(sessionId) {
      await accountApi.deleteSession(sessionId);
    },

    async getSession() {
      const sessions = await accountApi.listSessions();
      const current = sessions.find((s) => new Date(s.expire) > new Date());
      if (!current) return null;
      return mapSession(current);
    },

    async getCurrentUser() {
      const user = await accountApi.getCurrentUser();
      return mapUser(user);
    },

    async requestPasswordRecovery() {
      throw new Error("Password recovery not implemented yet");
    },

    async confirmPasswordRecovery() {
      throw new Error("Password recovery not implemented yet");
    },
  };
}
```

- [ ] **Step 2: Verify typecheck**

Run: `pnpm --filter @cdorneles/auth typecheck`
Expected: exit 0

- [ ] **Step 3: Commit**

```bash
git add packages/auth/src/appwrite-auth-service.ts
git commit -m "feat(auth): implement createAppwriteAuthService with login/logout/session/user"
```

---

### Task 4: Test createAppwriteAuthService

**Files:**
- Create: `packages/auth/src/appwrite-auth-service.test.ts`

- [ ] **Step 1: Write the test file**

```ts
import { describe, expect, it, vi } from "vitest";
import { createAppwriteAuthService } from "./appwrite-auth-service";
import type { AccountApi } from "@cdorneles/api-client";

function createMockAccountApi(): AccountApi {
  return {
    getCurrentUser: vi.fn(),
    listSessions: vi.fn(),
    createEmailPasswordSession: vi.fn(),
    deleteSession: vi.fn(),
  };
}

const futureDate = new Date(Date.now() + 86400000).toISOString();
const pastDate = new Date(Date.now() - 86400000).toISOString();

describe("createAppwriteAuthService", () => {
  it("is a function", () => {
    expect(typeof createAppwriteAuthService).toBe("function");
  });

  describe("login", () => {
    it("calls createEmailPasswordSession and returns mapped AuthSession", async () => {
      const api = createMockAccountApi();
      vi.mocked(api.createEmailPasswordSession).mockResolvedValue({
        $id: "s1",
        userId: "u1",
        expire: futureDate,
      });

      const service = createAppwriteAuthService(api);
      const session = await service.login({ email: "a@b.com", password: "pass" });

      expect(api.createEmailPasswordSession).toHaveBeenCalledWith({
        email: "a@b.com",
        password: "pass",
      });
      expect(session).toEqual({
        id: "s1",
        userId: "u1",
        expiresAt: futureDate,
      });
    });

    it("propagates SDK errors", async () => {
      const api = createMockAccountApi();
      vi.mocked(api.createEmailPasswordSession).mockRejectedValue(
        new Error("user_invalid_credentials"),
      );

      const service = createAppwriteAuthService(api);
      await expect(service.login({ email: "a@b.com", password: "wrong" })).rejects.toThrow(
        "user_invalid_credentials",
      );
    });
  });

  describe("logout", () => {
    it("calls deleteSession with provided sessionId", async () => {
      const api = createMockAccountApi();
      vi.mocked(api.deleteSession).mockResolvedValue(undefined);

      const service = createAppwriteAuthService(api);
      await service.logout("s1");

      expect(api.deleteSession).toHaveBeenCalledWith("s1");
    });

    it("calls deleteSession with undefined when no sessionId", async () => {
      const api = createMockAccountApi();
      vi.mocked(api.deleteSession).mockResolvedValue(undefined);

      const service = createAppwriteAuthService(api);
      await service.logout();

      expect(api.deleteSession).toHaveBeenCalledWith(undefined);
    });
  });

  describe("getSession", () => {
    it("returns first non-expired session", async () => {
      const api = createMockAccountApi();
      vi.mocked(api.listSessions).mockResolvedValue([
        { $id: "expired", userId: "u1", expire: pastDate },
        { $id: "active", userId: "u1", expire: futureDate },
      ]);

      const service = createAppwriteAuthService(api);
      const session = await service.getSession();

      expect(session).toEqual({
        id: "active",
        userId: "u1",
        expiresAt: futureDate,
      });
    });

    it("returns null when no sessions", async () => {
      const api = createMockAccountApi();
      vi.mocked(api.listSessions).mockResolvedValue([]);

      const service = createAppwriteAuthService(api);
      const session = await service.getSession();

      expect(session).toBeNull();
    });

    it("returns null when all sessions expired", async () => {
      const api = createMockAccountApi();
      vi.mocked(api.listSessions).mockResolvedValue([
        { $id: "s1", userId: "u1", expire: pastDate },
        { $id: "s2", userId: "u1", expire: pastDate },
      ]);

      const service = createAppwriteAuthService(api);
      const session = await service.getSession();

      expect(session).toBeNull();
    });
  });

  describe("getCurrentUser", () => {
    it("returns mapped AuthUser", async () => {
      const api = createMockAccountApi();
      vi.mocked(api.getCurrentUser).mockResolvedValue({
        $id: "u1",
        email: "user@example.com",
        name: "User",
        status: true,
        emailVerification: true,
        mfa: false,
      });

      const service = createAppwriteAuthService(api);
      const user = await service.getCurrentUser();

      expect(user).toEqual({
        id: "u1",
        email: "user@example.com",
        name: "User",
        emailVerified: true,
        mfaEnabled: false,
      });
    });

    it("propagates SDK errors", async () => {
      const api = createMockAccountApi();
      vi.mocked(api.getCurrentUser).mockRejectedValue(new Error("user_unauthorized"));

      const service = createAppwriteAuthService(api);
      await expect(service.getCurrentUser()).rejects.toThrow("user_unauthorized");
    });
  });

  describe("stubs", () => {
    it("completeMfa throws not implemented", async () => {
      const api = createMockAccountApi();
      const service = createAppwriteAuthService(api);
      await expect(service.completeMfa({ challengeId: "c1", code: "123" })).rejects.toThrow(
        "MFA not implemented yet",
      );
    });

    it("requestPasswordRecovery throws not implemented", async () => {
      const api = createMockAccountApi();
      const service = createAppwriteAuthService(api);
      await expect(service.requestPasswordRecovery({ email: "a@b.com" })).rejects.toThrow(
        "Password recovery not implemented yet",
      );
    });

    it("confirmPasswordRecovery throws not implemented", async () => {
      const api = createMockAccountApi();
      const service = createAppwriteAuthService(api);
      await expect(
        service.confirmPasswordRecovery({ userId: "u1", secret: "s", password: "p" }),
      ).rejects.toThrow("Password recovery not implemented yet");
    });
  });
});
```

- [ ] **Step 2: Run tests**

Run: `pnpm vitest run packages/auth`
Expected: all tests pass (existing + new ~13)

- [ ] **Step 3: Commit**

```bash
git add packages/auth/src/appwrite-auth-service.test.ts
git commit -m "test(auth): add tests for createAppwriteAuthService"
```

---

### Task 5: Export from index.ts

**Files:**
- Modify: `packages/auth/src/index.ts`

- [ ] **Step 1: Add export**

```ts
export * from "./appwrite-auth-service";
export * from "./auth-context";
export * from "./provider";
export * from "./types";
```

- [ ] **Step 2: Verify typecheck**

Run: `pnpm --filter @cdorneles/auth typecheck`
Expected: exit 0

- [ ] **Step 3: Verify all auth tests pass**

Run: `pnpm vitest run packages/auth`
Expected: all pass

- [ ] **Step 4: Commit**

```bash
git add packages/auth/src/index.ts
git commit -m "feat(auth): export createAppwriteAuthService from package"
```

---

### Task 6: Wire auth service in apps/admin

**Files:**
- Modify: `apps/admin/src/app/providers.tsx`

- [ ] **Step 1: Update providers.tsx**

```tsx
"use client";

import {
  createAppwriteServices,
  createQueryClient,
  resolveApiClientConfig,
} from "@cdorneles/api-client";
import { AuthProvider, createAppwriteAuthService } from "@cdorneles/auth";
import { TenantProvider } from "@cdorneles/tenant";
import { AppProvider } from "@cdorneles/ui";
import { AccessProvider } from "@cdorneles/ui/permissions";
import { useState, type ReactNode } from "react";

import { initObservability } from "@/lib/observability";

export function Providers({ children }: { children: ReactNode }) {
  const [queryClient] = useState(() => createQueryClient());
  const [authService] = useState(() => {
    const config = resolveApiClientConfig({
      endpoint: process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT,
      projectId: process.env.NEXT_PUBLIC_APPWRITE_PROJECT_ID,
    });
    const services = createAppwriteServices(config);
    return createAppwriteAuthService(services.account);
  });

  initObservability();

  return (
    <AppProvider queryClient={queryClient} organizationDefault="light">
      <AuthProvider service={authService}>
        <TenantProvider>
          <AccessProvider granted={{ permissions: [], features: [] }}>{children}</AccessProvider>
        </TenantProvider>
      </AuthProvider>
    </AppProvider>
  );
}
```

Note: the `queryClient` import is missing in the original — it comes from `@cdorneles/api-client`. The updated file imports `createAppwriteServices` and `resolveApiClientConfig` from the same package.

- [ ] **Step 2: Verify typecheck**

Run: `pnpm --filter admin typecheck`
Expected: exit 0

- [ ] **Step 3: Commit**

```bash
git add apps/admin/src/app/providers.tsx
git commit -m "feat(admin): wire Appwrite auth service"
```

---

### Task 7: Wire auth service in remaining apps

**Files:**
- Modify: `apps/client/src/app/providers.tsx`
- Modify: `apps/customer/src/app/providers.tsx`
- Modify: `apps/design-system/src/app/providers.tsx`

- [ ] **Step 1: Apply same change to apps/client**

Same as Task 6 — replace `createUnconfiguredAuthService` with `createAppwriteAuthService` + `createAppwriteServices`.

- [ ] **Step 2: Apply same change to apps/customer**

Same change.

- [ ] **Step 3: Apply same change to apps/design-system**

Same change.

- [ ] **Step 4: Verify typecheck for all apps**

Run: `pnpm typecheck`
Expected: all apps exit 0

- [ ] **Step 5: Commit**

```bash
git add apps/client/src/app/providers.tsx apps/customer/src/app/providers.tsx apps/design-system/src/app/providers.tsx
git commit -m "feat: wire Appwrite auth service in client, customer, design-system"
```

---

### Task 8: Full verification

- [ ] **Step 1: Lint**

Run: `pnpm lint`
Expected: 0 errors, 0 warnings

- [ ] **Step 2: Typecheck**

Run: `pnpm typecheck`
Expected: exit 0

- [ ] **Step 3: Test**

Run: `pnpm test`
Expected: all tests pass (85 existing + ~13 new = ~98 total)

- [ ] **Step 4: Build**

Run: `pnpm build`
Expected: exit 0

- [ ] **Step 5: Revert build artifacts**

Run: `git checkout -- apps/design-system/next-env.d.ts 2>/dev/null; true`
Expected: working tree clean (or only irrelevant artifacts)

- [ ] **Step 6: Final commit if needed**

If any fixes were needed during verification, commit them.

---

## SDK Facts

- `AccountApi.listSessions()` → `AppwriteSession[]` (our DTO: `$id`, `userId`, `expire`)
- `AccountApi.createEmailPasswordSession({ email, password })` → `AppwriteSession`
- `AccountApi.deleteSession(sessionId?)` → `void` (defaults to `"current"`)
- `AccountApi.getCurrentUser()` → `AppwriteAccount` (our DTO: `$id`, `email`, `name`, `status`, `emailVerification`, `mfa`)
- Object-parameter form is used throughout (positional overloads are `@deprecated`)

## Summary

| Task | What | Tests |
|---|---|---|
| 1 | Extend AppwriteAccount DTO | existing 85 pass |
| 2 | Add dependency | typecheck |
| 3 | Implement factory | typecheck |
| 4 | Test factory | ~13 new tests |
| 5 | Export | typecheck + tests |
| 6 | Wire admin | typecheck |
| 7 | Wire remaining apps | typecheck |
| 8 | Full gates | lint + typecheck + test + build |
