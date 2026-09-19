# Appwrite Auth Service — Design Spec

**Date:** 2026-09-18
**Status:** Approved
**Scope:** Session 2 — wire `@cdorneles/auth` to the Appwrite adapter

## Context

Session 1 delivered the Appwrite SDK adapter behind `@cdorneles/api-client`.
The `@cdorneles/auth` package defines `AuthService` (login, logout, session,
current user, MFA, recovery) and ships a placeholder `createUnconfiguredAuthService`
that throws on every call. Applications cannot authenticate yet.

This design delivers the real Appwrite-backed `AuthService` for the core
authentication flow (login, logout, session, current user). MFA and password
recovery are deferred as stubs.

## Goal

Replace `createUnconfiguredAuthService()` with a real `createAppwriteAuthService()`
that uses the existing `AccountApi` from `@cdorneles/api-client` to authenticate
users against Appwrite.

## Non-Goals

- MFA challenge/complete flow — deferred.
- Password recovery flow — deferred.
- Session refresh/background sync — the `AuthProvider` already calls `refresh()`.
- Provisioning Appwrite backend (databases, teams, seeds) — Session 3.

## Architecture

### New file

```text
packages/auth/src/
  appwrite-auth-service.ts   # createAppwriteAuthService(accountApi) -> AuthService
  appwrite-auth-service.test.ts
```

### Factory signature

```ts
import type { AccountApi } from "@cdorneles/api-client";
import type { AuthService } from "./types";

export function createAppwriteAuthService(accountApi: AccountApi): AuthService;
```

Receives the existing `AccountApi` (no raw SDK Client, no new dependencies inside
the auth service). Returns the `AuthService` interface.

### Dependency

`@cdorneles/auth` gains a dependency on `@cdorneles/api-client` (types only).
This is acceptable because `@cdorneles/api-client` is the canonical Appwrite
abstraction layer per architecture.

### Application wiring

Each app's `providers.tsx` changes from:

```ts
import { createUnconfiguredAuthService } from "@cdorneles/auth";
// ...
const [authService] = useState(() => createUnconfiguredAuthService());
```

to:

```ts
import { createAppwriteAuthService } from "@cdorneles/auth";
import { createAppwriteServices } from "@cdorneles/api-client";
// ...
const [services] = useState(() => createAppwriteServices(config));
const [authService] = useState(() => createAppwriteAuthService(services.account));
```

The `config` (`ApiClientConfig`) must be sourced from environment variables
or a configuration module. The exact config source is application-specific and
already exists (all apps import `@cdorneles/api-client`).

## Data Flow

### `login({ email, password })`

```ts
const session = await accountApi.createEmailPasswordSession({ email, password });
return { id: session.$id, userId: session.userId, expiresAt: session.expire };
```

### `logout(sessionId?)`

```ts
await accountApi.deleteSession({ sessionId: sessionId || "current" });
```

Uses `"current"` as fallback (empty-string safe, matches adapter convention).

### `getSession()`

```ts
const { sessions } = await accountApi.listSessions();
const current = sessions.find((s) => new Date(s.expire) > new Date());
if (!current) return null;
return { id: current.$id, userId: current.userId, expiresAt: current.expire };
```

Returns the first non-expired session, or `null`. No error thrown when no
session exists — the caller (AuthProvider) handles the "anonymous" state.

### `getCurrentUser()`

```ts
const user = await accountApi.getCurrentUser();
return {
  id: user.$id,
  email: user.email,
  name: user.name,
  emailVerified: user.emailVerification,
  mfaEnabled: user.mfa,
};
```

### Stubs (deferred)

```ts
completeMfa: () => Promise.reject(new Error("MFA not implemented yet")),
requestPasswordRecovery: () => Promise.reject(new Error("Password recovery not implemented yet")),
confirmPasswordRecovery: () => Promise.reject(new Error("Password recovery not implemented yet")),
```

## Type Mapping

| Appwrite SDK (`Models.Session`) | `AuthSession` |
|---|---|
| `$id` | `id` |
| `userId` | `userId` |
| `expire` | `expiresAt` |

| Appwrite SDK (`Models.User`) | `AuthUser` |
|---|---|
| `$id` | `id` |
| `email` | `email` |
| `name` | `name` |
| `emailVerification` | `emailVerified` |
| `mfa` | `mfaEnabled` |

## Error Handling

All errors flow from the `AccountApi` adapter (which wraps `mapAppwriteError`)
directly to the caller. No re-wrapping in the auth service.

| Scenario | SDK behavior | Result |
|---|---|---|
| Invalid credentials (`login`) | `AppwriteException` type `user_invalid_credentials` | `ApiError({ code: "user_invalid_credentials", status: 401 })` propagates |
| No active session (`getSession`) | `listSessions()` returns empty or all expired | Returns `null` |
| Unauthenticated (`getCurrentUser`) | `AppwriteException` type `user_unauthorized` | `ApiError({ code: "user_unauthorized", status: 401 })` propagates |

## Testing

File: `packages/auth/src/appwrite-auth-service.test.ts`

Mock the `AccountApi` with `vi.fn()` (no real SDK, no network).

### Test cases

1. `createAppwriteAuthService` — is a function
2. `login` — calls `createEmailPasswordSession` with correct params, returns mapped `AuthSession`
3. `login failure` — propagates SDK error
4. `logout` — calls `deleteSession` with provided `sessionId`
5. `logout default` — calls `deleteSession` with `"current"` when `sessionId` is undefined
6. `getSession` — returns first non-expired session
7. `getSession empty` — returns `null` when no sessions
8. `getSession expired` — returns `null` when all sessions expired
9. `getCurrentUser` — returns mapped `AuthUser`
10. `getCurrentUser unauthorized` — propagates SDK error
11. `completeMfa` — throws "not implemented"
12. `requestPasswordRecovery` — throws "not implemented"
13. `confirmPasswordRecovery` — throws "not implemented"

~13 tests total.

## Files Modified

| File | Change |
|---|---|
| `packages/auth/src/appwrite-auth-service.ts` | **New** — factory implementation |
| `packages/auth/src/appwrite-auth-service.test.ts` | **New** — tests |
| `packages/auth/src/index.ts` | Add export |
| `packages/auth/package.json` | Add `@cdorneles/api-client` dependency |
| `apps/admin/src/app/providers.tsx` | Wire real auth service |
| `apps/client/src/app/providers.tsx` | Wire real auth service |
| `apps/customer/src/app/providers.tsx` | Wire real auth service |
| `apps/design-system/src/app/providers.tsx` | Wire real auth service |

## Validation

After implementation:

- `pnpm lint` — 0 errors, 0 warnings
- `pnpm typecheck` — exit 0
- `pnpm test` — all tests pass (existing 85 + ~13 new)
- `pnpm build` — exit 0
- End-to-end: login form in `apps/design-system` authenticates against Appwrite
