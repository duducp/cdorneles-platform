# Appwrite SDK Adapter for `@cdorneles/api-client` — Design

Date: 2026-09-18
Status: Approved
Scope: `packages/api-client` only

## Context

The Foundation defines the `@cdorneles/api-client` contracts — `AccountApi`,
`TeamsApi`, `DatabasesApi`, `FunctionsApi`, `StorageApi`, `ApiClient` and
`createApiClient` — but ships no concrete backend implementation. The README and
`docs/development/README.md` list "the concrete Appwrite SDK adapter for
`@cdorneles/api-client`" as intentionally deferred pending approval.

This design delivers that adapter for the **Appwrite Web SDK only** (browser
session, no API key), so applications keep talking to Appwrite exclusively
through `@cdorneles/api-client` (ADR-003, ARCHITECTURE §4).

The Appwrite project is currently empty (0 databases, 0 teams, 0 functions,
0 users). The adapter is therefore validated against a mocked SDK, not a live
backend. App wiring and backend provisioning are out of scope.

## Goals

- Implement all five service interfaces against the real `appwrite` Web SDK.
- Preserve the existing contracts; `createApiClient` remains the injection point.
- Normalize every failure to `ApiError`.
- Test without network access.

## Non-Goals

- Server-side adapter (`node-appwrite` + API key) — deferred.
- Wiring `@cdorneles/auth` / apps to the adapter — separate work item.
- Provisioning Appwrite databases, collections, teams, functions or seeds.
- Any business module.

## Public API

New exports from `@cdorneles/api-client`:

```ts
createAppwriteServices(config: ApiClientConfig): AppwriteServices;
createAppwriteApiClient(config: ApiClientConfig): ApiClient;
```

- `createAppwriteServices` builds one SDK `Client` and returns the five services.
- `createAppwriteApiClient` wraps `createApiClient({ config, services })`.
- Existing `createApiClient`, interfaces, DTOs and `ApiError` are unchanged.
- The per-service factories stay internal (not exported); tests import them by
  relative path.

## Structure

```text
packages/api-client/src/
  adapters/
    client.ts        # createAppwriteClient(config) -> SDK Client
    account.ts       # createAccountApi(client) -> AccountApi
    teams.ts         # createTeamsApi(client) -> TeamsApi
    databases.ts     # createDatabasesApi(client) -> DatabasesApi
    functions.ts     # createFunctionsApi(client) -> FunctionsApi
    storage.ts       # createStorageApi(client) -> StorageApi
    map-error.ts     # mapAppwriteError(error) -> ApiError
    appwrite.ts      # createAppwriteServices / createAppwriteApiClient
  client.ts          # unchanged (contracts + createApiClient)
  config.ts          # unchanged
  dto.ts             # unchanged
  errors.ts          # unchanged
  index.ts           # re-exports the two new factories
```

Each adapter is a pure function that receives the SDK `Client` and returns the
matching interface. The `Client` is created once per `createAppwriteServices`
call — never at module top level — so importing the package has no side effects.

## Mapping

### account → `AccountApi`

| Adapter method             | SDK call                                        | DTO                    |
| -------------------------- | ----------------------------------------------- | ---------------------- |
| `getCurrentUser`           | `account.get()`                                 | `AppwriteAccount`      |
| `listSessions`             | `account.listSessions()`                        | `AppwriteSession[]`    |
| `createEmailPasswordSession` | `account.createEmailPasswordSession(email, password)` | `AppwriteSession` |
| `deleteSession(sessionId?)` | `account.deleteSession(sessionId ?? "current")` | —                      |

### teams → `TeamsApi`

| Adapter method     | SDK call                          | DTO                     |
| ------------------ | --------------------------------- | ----------------------- |
| `listTeams`        | `teams.list()`                    | `AppwriteTeam[]`        |
| `listMemberships`  | `teams.listMemberships(teamId)`   | `AppwriteMembership[]`  |

### databases → `DatabasesApi`

| Adapter method   | SDK call                                                            | DTO                  |
| ---------------- | ------------------------------------------------------------------- | -------------------- |
| `listDocuments`  | `databases.listDocuments(databaseId, collectionId, queries)` → `.documents` | `AppwriteDocument[]` |
| `getDocument`    | `databases.getDocument(databaseId, collectionId, documentId)`       | `AppwriteDocument`   |

`queries` is already `string[]` in the contract, matching the SDK's `Query`
string type.

### functions → `FunctionsApi`

| Adapter method    | SDK call                                                                    | DTO                 |
| ----------------- | --------------------------------------------------------------------------- | ------------------- |
| `createExecution` | `functions.createExecution(functionId, body, false, path, method)`          | `AppwriteExecution` |

### storage → `StorageApi`

| Adapter method      | SDK call                                                     | Returns |
| ------------------- | ------------------------------------------------------------ | ------- |
| `getFilePreviewUrl` | `storage.getFilePreview(bucketId, fileId, width, height)` → `.toString()` | `string` |

`getFilePreview` is synchronous and returns a URL object; the adapter converts it
to a string. Width/height are optional.

## Error Handling

Every adapter call is wrapped so callers only ever see `ApiError`.

```ts
function mapAppwriteError(error: unknown): ApiError;
```

- `AppwriteException` → `new ApiError(message, { code: type || "appwrite",
  status: code || undefined, cause: error })`. The SDK defaults `type` to `""`
  and `code` to `0`, so `||` (not `??`) is required: an empty type becomes the
  stable `"appwrite"` code and a non-HTTP `0` becomes `undefined`.
- Anything else → `toApiError(error)`.

No credentials, tokens or session secrets are logged at any point.

## Runtime Constraints

- Web SDK only (`appwrite`), which relies on browser storage for sessions.
- No API key is used, so nothing here is secret; the adapter is safe to import in
  any bundle, but session operations require a browser/authenticated context.
- The adapter must not be instantiated at import time.

## Dependency

Add `appwrite@27.0.0` to the pnpm `catalog` (`pnpm-workspace.yaml`) and to
`@cdorneles/api-client` dependencies as `catalog:`. This is the only new
dependency and requires the approval already granted for this work item.

## Testing

Vitest with a hand-rolled/mocked SDK client (`vi.fn()` per method). Tests live
next to the source as `packages/api-client/src/**/*.test.ts` and assert:

1. each adapter calls the correct SDK method with the correct arguments;
2. DTOs are mapped to the expected shape;
3. SDK errors become `ApiError` with the expected `code`/`status`;
4. the factory returns a client whose `config` and services are wired.

No live network calls in tests.

## Verification

Run from the repository root: `pnpm lint`, `pnpm typecheck`, `pnpm test`,
`pnpm build`. All must pass before the item is considered done
(`DEFINITION_OF_DONE.md`).

## Risks

- **SDK version drift.** The adapter is written against `appwrite@27.0.0`; a major
  SDK bump may change method signatures. Pinned via the catalog to keep it
  explicit.
- **Untested against a live backend.** Mapping is verified against the SDK's
  documented shapes and types; real responses are validated when app wiring and
  backend provisioning land.
