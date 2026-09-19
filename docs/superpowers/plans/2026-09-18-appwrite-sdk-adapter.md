# Appwrite SDK Adapter Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement the concrete Appwrite Web SDK adapter behind the existing `@cdorneles/api-client` interfaces.

**Architecture:** One pure factory per service (`createAccountApi`, `createTeamsApi`, …) that receives the SDK `Client` and returns the existing interface. A top-level factory builds one `Client` and composes the five services; `createAppwriteApiClient` wraps `createApiClient`. Every SDK failure is normalized to `ApiError`.

**Tech Stack:** TypeScript, `appwrite@27.0.0` (Web SDK), Vitest, pnpm catalog.

**Spec:** `docs/superpowers/specs/2026-09-18-appwrite-sdk-adapter-design.md`

**SDK facts (verified against `appwrite@27.0.0` types):**

- `import { Client, Account, Teams, Databases, Functions, Storage, AppwriteException } from "appwrite"`.
- `AppwriteException` constructor: `(message: string, code?: number, type?: string, response?: string)`; fields `code: number`, `type: string`.
- `Account.get()` → `User` (`$id`, `email`, `name`, `status`); `listSessions()` → `{ sessions }`; `createEmailPasswordSession(email, password)`; `deleteSession(sessionId)`.
- `Teams.list()` → `{ teams }`; `listMemberships(teamId)` → `{ memberships }`.
- `Databases.listDocuments(databaseId, collectionId, queries?)` → `{ documents }`; `getDocument(databaseId, collectionId, documentId, queries?)`.
- `Functions.createExecution(functionId, body?, async?, xpath?, method?, headers?, scheduledAt?)` → `Execution` (`$id`, `status`, `responseBody`); `method` is the `ExecutionMethod` enum.
- `Storage.getFilePreview(bucketId, fileId, width?, height?, …)` returns a `string` synchronously.

**Repository conventions:**

- Shared packages are consumed as TypeScript source; no build step.
- Imports are grouped: external packages, blank line, relative imports. Prettier formats, ESLint lints.
- Tests run from the repository root with `pnpm test` (Vitest, jsdom).
- Commits use Conventional Commits.

---

## File Structure

```text
packages/api-client/src/
  adapters/
    map-error.ts        # mapAppwriteError(error) -> ApiError
    client.ts           # createAppwriteClient(config) -> SDK Client
    account.ts          # createAccountApi(client) -> AccountApi
    teams.ts            # createTeamsApi(client) -> TeamsApi
    databases.ts        # createDatabasesApi(client) -> DatabasesApi
    functions.ts        # createFunctionsApi(client) -> FunctionsApi
    storage.ts          # createStorageApi(client) -> StorageApi
    appwrite.ts         # createAppwriteServices / createAppwriteApiClient
    map-error.test.ts
    client.test.ts
    account.test.ts
    teams.test.ts
    databases.test.ts
    functions.test.ts
    storage.test.ts
    appwrite.test.ts
  index.ts              # + re-export the two public factories
```

Modified files: `pnpm-workspace.yaml`, `packages/api-client/package.json`, `packages/api-client/src/index.ts`, `README.md`, `docs/development/README.md`, `TODO.md`.

---

## Task 1: Add the `appwrite` dependency

**Files:**
- Modify: `pnpm-workspace.yaml`
- Modify: `packages/api-client/package.json`

- [ ] **Step 1: Add the version to the catalog**

In `pnpm-workspace.yaml`, under the `# Runtime` group, add this line after `"zustand": 5.0.15,`:

```yaml
  "appwrite": 27.0.0
```

- [ ] **Step 2: Reference the catalog from the package**

In `packages/api-client/package.json`, replace the `dependencies` block:

```json
  "dependencies": {
    "@tanstack/react-query": "catalog:",
    "appwrite": "catalog:"
  },
```

- [ ] **Step 3: Install**

Run: `pnpm install`
Expected: lockfile updates, install completes with no error.

- [ ] **Step 4: Verify the package still typechecks**

Run: `pnpm --filter @cdorneles/api-client typecheck`
Expected: exit code 0 (no output).

- [ ] **Step 5: Commit**

```bash
git add pnpm-workspace.yaml pnpm-lock.yaml packages/api-client/package.json
git commit -m "chore(api-client): add appwrite web sdk dependency"
```

---

## Task 2: Error mapping

**Files:**
- Create: `packages/api-client/src/adapters/map-error.ts`
- Test: `packages/api-client/src/adapters/map-error.test.ts`

- [ ] **Step 1: Write the failing test**

Create `packages/api-client/src/adapters/map-error.test.ts`:

```ts
import { AppwriteException } from "appwrite";
import { describe, expect, it } from "vitest";

import { ApiError } from "../errors";
import { mapAppwriteError } from "./map-error";

describe("mapAppwriteError", () => {
  it("maps an AppwriteException to an ApiError", () => {
    const mapped = mapAppwriteError(new AppwriteException("Unauthorized", 401, "user_unauthorized"));

    expect(mapped).toBeInstanceOf(ApiError);
    expect(mapped.message).toBe("Unauthorized");
    expect(mapped.code).toBe("user_unauthorized");
    expect(mapped.status).toBe(401);
  });

  it("falls back to a generic code when the type is empty", () => {
    const mapped = mapAppwriteError(new AppwriteException("Boom"));

    expect(mapped.code).toBe("appwrite");
    expect(mapped.status).toBeUndefined();
  });

  it("normalizes non-Appwrite errors", () => {
    const mapped = mapAppwriteError(new Error("network"));

    expect(mapped).toBeInstanceOf(ApiError);
    expect(mapped.code).toBe("unknown");
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm vitest run packages/api-client/src/adapters/map-error.test.ts`
Expected: FAIL — cannot resolve `./map-error`.

- [ ] **Step 3: Write the minimal implementation**

Create `packages/api-client/src/adapters/map-error.ts`:

```ts
import { AppwriteException } from "appwrite";

import { ApiError, toApiError } from "../errors";

/**
 * Normalizes any error crossing the Appwrite SDK boundary to an `ApiError`.
 * The Appwrite error `type` (e.g. `user_unauthorized`) becomes the stable code
 * and the HTTP status is preserved for callers that need it.
 */
export function mapAppwriteError(error: unknown): ApiError {
  if (error instanceof AppwriteException) {
    return new ApiError(error.message, {
      code: error.type || "appwrite",
      status: error.code || undefined,
      cause: error,
    });
  }
  return toApiError(error);
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `pnpm vitest run packages/api-client/src/adapters/map-error.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add packages/api-client/src/adapters/map-error.ts packages/api-client/src/adapters/map-error.test.ts
git commit -m "feat(api-client): normalize appwrite errors to ApiError"
```

---

## Task 3: SDK client factory

**Files:**
- Create: `packages/api-client/src/adapters/client.ts`
- Test: `packages/api-client/src/adapters/client.test.ts`

- [ ] **Step 1: Write the failing test**

Create `packages/api-client/src/adapters/client.test.ts`:

```ts
import { Client } from "appwrite";
import { describe, expect, it } from "vitest";

import { createAppwriteClient } from "./client";

describe("createAppwriteClient", () => {
  it("binds the endpoint and project to a real Appwrite client", () => {
    const client = createAppwriteClient({
      endpoint: "https://appwrite.example/v1",
      projectId: "p1",
    });

    expect(client).toBeInstanceOf(Client);
    expect(client.config.endpoint).toContain("appwrite.example");
    expect(client.config.project).toBe("p1");
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm vitest run packages/api-client/src/adapters/client.test.ts`
Expected: FAIL — cannot resolve `./client`.

- [ ] **Step 3: Write the minimal implementation**

Create `packages/api-client/src/adapters/client.ts`:

```ts
import { Client } from "appwrite";

import type { ApiClientConfig } from "../config";

/**
 * Creates the single Appwrite Web SDK client used by every service adapter.
 * Called from `createAppwriteServices`, never at module top level, so importing
 * the package has no side effects.
 */
export function createAppwriteClient(config: ApiClientConfig): Client {
  return new Client().setEndpoint(config.endpoint).setProject(config.projectId);
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `pnpm vitest run packages/api-client/src/adapters/client.test.ts`
Expected: PASS (1 test).

- [ ] **Step 5: Commit**

```bash
git add packages/api-client/src/adapters/client.ts packages/api-client/src/adapters/client.test.ts
git commit -m "feat(api-client): add appwrite client factory"
```

---

## Task 4: Account adapter

**Files:**
- Create: `packages/api-client/src/adapters/account.ts`
- Test: `packages/api-client/src/adapters/account.test.ts`

- [ ] **Step 1: Write the failing test**

Create `packages/api-client/src/adapters/account.test.ts`:

```ts
import { AppwriteException, type Client } from "appwrite";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ApiError } from "../errors";
import { createAccountApi } from "./account";

const mocks = vi.hoisted(() => ({
  account: {
    get: vi.fn(),
    listSessions: vi.fn(),
    createEmailPasswordSession: vi.fn(),
    deleteSession: vi.fn(),
  },
}));

vi.mock("appwrite", async (importOriginal) => {
  const actual = await importOriginal<typeof import("appwrite")>();
  return { ...actual, Account: vi.fn(function Account() { return mocks.account; }) };
});

const client = {} as Client;

beforeEach(() => {
  vi.clearAllMocks();
});

describe("createAccountApi", () => {
  it("maps the current user", async () => {
    mocks.account.get.mockResolvedValue({
      $id: "u1",
      email: "a@b.c",
      name: "Ada",
      status: true,
    });

    const api = createAccountApi(client);

    await expect(api.getCurrentUser()).resolves.toEqual({
      $id: "u1",
      email: "a@b.c",
      name: "Ada",
      status: true,
    });
  });

  it("maps sessions", async () => {
    mocks.account.listSessions.mockResolvedValue({
      sessions: [{ $id: "s1", userId: "u1", expire: "2026-01-01T00:00:00.000Z" }],
    });

    const api = createAccountApi(client);

    await expect(api.listSessions()).resolves.toEqual([
      { $id: "s1", userId: "u1", expire: "2026-01-01T00:00:00.000Z" },
    ]);
  });

  it("creates an email/password session with the given credentials", async () => {
    mocks.account.createEmailPasswordSession.mockResolvedValue({
      $id: "s1",
      userId: "u1",
      expire: "2026-01-01T00:00:00.000Z",
    });

    const api = createAccountApi(client);
    const session = await api.createEmailPasswordSession({
      email: "a@b.c",
      password: "secret",
    });

    expect(mocks.account.createEmailPasswordSession).toHaveBeenCalledWith("a@b.c", "secret");
    expect(session).toEqual({
      $id: "s1",
      userId: "u1",
      expire: "2026-01-01T00:00:00.000Z",
    });
  });

  it("deletes the current session by default", async () => {
    mocks.account.deleteSession.mockResolvedValue(undefined);

    const api = createAccountApi(client);
    await api.deleteSession();

    expect(mocks.account.deleteSession).toHaveBeenCalledWith("current");
  });

  it("deletes an explicit session", async () => {
    mocks.account.deleteSession.mockResolvedValue(undefined);

    const api = createAccountApi(client);
    await api.deleteSession("s9");

    expect(mocks.account.deleteSession).toHaveBeenCalledWith("s9");
  });

  it("wraps failures in ApiError", async () => {
    mocks.account.get.mockRejectedValue(
      new AppwriteException("nope", 401, "user_unauthorized"),
    );

    const api = createAccountApi(client);

    await expect(api.getCurrentUser()).rejects.toBeInstanceOf(ApiError);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm vitest run packages/api-client/src/adapters/account.test.ts`
Expected: FAIL — cannot resolve `./account`.

- [ ] **Step 3: Write the minimal implementation**

Create `packages/api-client/src/adapters/account.ts`:

```ts
import { Account } from "appwrite";
import type { Client } from "appwrite";

import type { AccountApi } from "../client";
import type { AppwriteAccount, AppwriteSession } from "../dto";
import { mapAppwriteError } from "./map-error";

export function createAccountApi(client: Client): AccountApi {
  const account = new Account(client);

  return {
    async getCurrentUser(): Promise<AppwriteAccount> {
      try {
        const user = await account.get();
        return { $id: user.$id, email: user.email, name: user.name, status: user.status };
      } catch (error) {
        throw mapAppwriteError(error);
      }
    },

    async listSessions(): Promise<AppwriteSession[]> {
      try {
        const result = await account.listSessions();
        return result.sessions.map((session) => ({
          $id: session.$id,
          userId: session.userId,
          expire: session.expire,
        }));
      } catch (error) {
        throw mapAppwriteError(error);
      }
    },

    async createEmailPasswordSession(input): Promise<AppwriteSession> {
      try {
        const session = await account.createEmailPasswordSession(input.email, input.password);
        return { $id: session.$id, userId: session.userId, expire: session.expire };
      } catch (error) {
        throw mapAppwriteError(error);
      }
    },

    async deleteSession(sessionId): Promise<void> {
      try {
        await account.deleteSession(sessionId ?? "current");
      } catch (error) {
        throw mapAppwriteError(error);
      }
    },
  };
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `pnpm vitest run packages/api-client/src/adapters/account.test.ts`
Expected: PASS (6 tests).

- [ ] **Step 5: Commit**

```bash
git add packages/api-client/src/adapters/account.ts packages/api-client/src/adapters/account.test.ts
git commit -m "feat(api-client): add account adapter"
```

---

## Task 5: Teams adapter

**Files:**
- Create: `packages/api-client/src/adapters/teams.ts`
- Test: `packages/api-client/src/adapters/teams.test.ts`

- [ ] **Step 1: Write the failing test**

Create `packages/api-client/src/adapters/teams.test.ts`:

```ts
import { AppwriteException, type Client } from "appwrite";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ApiError } from "../errors";
import { createTeamsApi } from "./teams";

const mocks = vi.hoisted(() => ({
  teams: {
    list: vi.fn(),
    listMemberships: vi.fn(),
  },
}));

vi.mock("appwrite", async (importOriginal) => {
  const actual = await importOriginal<typeof import("appwrite")>();
  return { ...actual, Teams: vi.fn(function Teams() { return mocks.teams; }) };
});

const client = {} as Client;

beforeEach(() => {
  vi.clearAllMocks();
});

describe("createTeamsApi", () => {
  it("maps teams", async () => {
    mocks.teams.list.mockResolvedValue({
      teams: [
        { $id: "t1", name: "Acme" },
        { $id: "t2", name: "Globex" },
      ],
    });

    const api = createTeamsApi(client);

    await expect(api.listTeams()).resolves.toEqual([
      { $id: "t1", name: "Acme" },
      { $id: "t2", name: "Globex" },
    ]);
  });

  it("maps memberships for a team", async () => {
    mocks.teams.listMemberships.mockResolvedValue({
      memberships: [{ $id: "m1", teamId: "t1", userId: "u1", roles: ["owner"] }],
    });

    const api = createTeamsApi(client);
    const memberships = await api.listMemberships("t1");

    expect(mocks.teams.listMemberships).toHaveBeenCalledWith("t1");
    expect(memberships).toEqual([
      { $id: "m1", teamId: "t1", userId: "u1", roles: ["owner"] },
    ]);
  });

  it("wraps failures in ApiError", async () => {
    mocks.teams.list.mockRejectedValue(
      new AppwriteException("nope", 401, "user_unauthorized"),
    );

    const api = createTeamsApi(client);

    await expect(api.listTeams()).rejects.toBeInstanceOf(ApiError);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm vitest run packages/api-client/src/adapters/teams.test.ts`
Expected: FAIL — cannot resolve `./teams`.

- [ ] **Step 3: Write the minimal implementation**

Create `packages/api-client/src/adapters/teams.ts`:

```ts
import { Teams } from "appwrite";
import type { Client } from "appwrite";

import type { TeamsApi } from "../client";
import type { AppwriteMembership, AppwriteTeam } from "../dto";
import { mapAppwriteError } from "./map-error";

export function createTeamsApi(client: Client): TeamsApi {
  const teams = new Teams(client);

  return {
    async listTeams(): Promise<AppwriteTeam[]> {
      try {
        const result = await teams.list();
        return result.teams.map((team) => ({ $id: team.$id, name: team.name }));
      } catch (error) {
        throw mapAppwriteError(error);
      }
    },

    async listMemberships(teamId): Promise<AppwriteMembership[]> {
      try {
        const result = await teams.listMemberships(teamId);
        return result.memberships.map((membership) => ({
          $id: membership.$id,
          teamId: membership.teamId,
          userId: membership.userId,
          roles: membership.roles,
        }));
      } catch (error) {
        throw mapAppwriteError(error);
      }
    },
  };
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `pnpm vitest run packages/api-client/src/adapters/teams.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add packages/api-client/src/adapters/teams.ts packages/api-client/src/adapters/teams.test.ts
git commit -m "feat(api-client): add teams adapter"
```

---

## Task 6: Databases adapter

**Files:**
- Create: `packages/api-client/src/adapters/databases.ts`
- Test: `packages/api-client/src/adapters/databases.test.ts`

- [ ] **Step 1: Write the failing test**

Create `packages/api-client/src/adapters/databases.test.ts`:

```ts
import { AppwriteException, type Client } from "appwrite";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ApiError } from "../errors";
import { createDatabasesApi } from "./databases";

const mocks = vi.hoisted(() => ({
  databases: {
    listDocuments: vi.fn(),
    getDocument: vi.fn(),
  },
}));

vi.mock("appwrite", async (importOriginal) => {
  const actual = await importOriginal<typeof import("appwrite")>();
  return { ...actual, Databases: vi.fn(function Databases() { return mocks.databases; }) };
});

const client = {} as Client;

beforeEach(() => {
  vi.clearAllMocks();
});

describe("createDatabasesApi", () => {
  it("lists documents with the given queries", async () => {
    mocks.databases.listDocuments.mockResolvedValue({
      documents: [
        { $id: "d1", $createdAt: "2026-01-01T00:00:00.000Z", $updatedAt: "2026-01-01T00:00:00.000Z", name: "Acme" },
      ],
    });

    const api = createDatabasesApi(client);
    const documents = await api.listDocuments({
      databaseId: "db",
      collectionId: "col",
      queries: ["limit(10)"],
    });

    expect(mocks.databases.listDocuments).toHaveBeenCalledWith("db", "col", ["limit(10)"]);
    expect(documents).toEqual([
      { $id: "d1", $createdAt: "2026-01-01T00:00:00.000Z", $updatedAt: "2026-01-01T00:00:00.000Z", name: "Acme" },
    ]);
  });

  it("gets a single document", async () => {
    mocks.databases.getDocument.mockResolvedValue({
      $id: "d1",
      $createdAt: "2026-01-01T00:00:00.000Z",
      $updatedAt: "2026-01-01T00:00:00.000Z",
      name: "Acme",
    });

    const api = createDatabasesApi(client);
    const document = await api.getDocument({
      databaseId: "db",
      collectionId: "col",
      documentId: "d1",
    });

    expect(mocks.databases.getDocument).toHaveBeenCalledWith("db", "col", "d1");
    expect(document).toEqual({
      $id: "d1",
      $createdAt: "2026-01-01T00:00:00.000Z",
      $updatedAt: "2026-01-01T00:00:00.000Z",
      name: "Acme",
    });
  });

  it("wraps failures in ApiError", async () => {
    mocks.databases.listDocuments.mockRejectedValue(
      new AppwriteException("nope", 404, "document_not_found"),
    );

    const api = createDatabasesApi(client);

    await expect(
      api.listDocuments({ databaseId: "db", collectionId: "col" }),
    ).rejects.toBeInstanceOf(ApiError);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm vitest run packages/api-client/src/adapters/databases.test.ts`
Expected: FAIL — cannot resolve `./databases`.

- [ ] **Step 3: Write the minimal implementation**

Create `packages/api-client/src/adapters/databases.ts`:

```ts
import { Databases } from "appwrite";
import type { Client } from "appwrite";

import type { DatabasesApi } from "../client";
import type { AppwriteDocument } from "../dto";
import { mapAppwriteError } from "./map-error";

export function createDatabasesApi(client: Client): DatabasesApi {
  const databases = new Databases(client);

  return {
    async listDocuments(input): Promise<AppwriteDocument[]> {
      try {
        const result = await databases.listDocuments(
          input.databaseId,
          input.collectionId,
          input.queries,
        );
        return result.documents.map((document) => ({ ...document }));
      } catch (error) {
        throw mapAppwriteError(error);
      }
    },

    async getDocument(input): Promise<AppwriteDocument> {
      try {
        const document = await databases.getDocument(
          input.databaseId,
          input.collectionId,
          input.documentId,
        );
        return { ...document };
      } catch (error) {
        throw mapAppwriteError(error);
      }
    },
  };
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `pnpm vitest run packages/api-client/src/adapters/databases.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add packages/api-client/src/adapters/databases.ts packages/api-client/src/adapters/databases.test.ts
git commit -m "feat(api-client): add databases adapter"
```

---

## Task 7: Functions adapter

**Files:**
- Create: `packages/api-client/src/adapters/functions.ts`
- Test: `packages/api-client/src/adapters/functions.test.ts`

- [ ] **Step 1: Write the failing test**

Create `packages/api-client/src/adapters/functions.test.ts`:

```ts
import { AppwriteException, type Client } from "appwrite";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ApiError } from "../errors";
import { createFunctionsApi } from "./functions";

const mocks = vi.hoisted(() => ({
  functions: {
    createExecution: vi.fn(),
  },
}));

vi.mock("appwrite", async (importOriginal) => {
  const actual = await importOriginal<typeof import("appwrite")>();
  return { ...actual, Functions: vi.fn(function Functions() { return mocks.functions; }) };
});

const client = {} as Client;

beforeEach(() => {
  vi.clearAllMocks();
});

describe("createFunctionsApi", () => {
  it("maps an execution and forwards the request", async () => {
    mocks.functions.createExecution.mockResolvedValue({
      $id: "e1",
      status: "completed",
      responseBody: '{"ok":true}',
    });

    const api = createFunctionsApi(client);
    const execution = await api.createExecution({
      functionId: "fn1",
      body: '{"x":1}',
      path: "/run",
      method: "POST",
    });

    expect(mocks.functions.createExecution).toHaveBeenCalledWith(
      "fn1",
      '{"x":1}',
      false,
      "/run",
      "POST",
    );
    expect(execution).toEqual({ $id: "e1", status: "completed", responseBody: '{"ok":true}' });
  });

  it("wraps failures in ApiError", async () => {
    mocks.functions.createExecution.mockRejectedValue(
      new AppwriteException("nope", 401, "user_unauthorized"),
    );

    const api = createFunctionsApi(client);

    await expect(api.createExecution({ functionId: "fn1" })).rejects.toBeInstanceOf(ApiError);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm vitest run packages/api-client/src/adapters/functions.test.ts`
Expected: FAIL — cannot resolve `./functions`.

- [ ] **Step 3: Write the minimal implementation**

Create `packages/api-client/src/adapters/functions.ts`:

```ts
import { Functions } from "appwrite";
import type { Client, ExecutionMethod } from "appwrite";

import type { FunctionsApi } from "../client";
import type { AppwriteExecution } from "../dto";
import { mapAppwriteError } from "./map-error";

export function createFunctionsApi(client: Client): FunctionsApi {
  const functions = new Functions(client);

  return {
    async createExecution(input): Promise<AppwriteExecution> {
      try {
        const execution = await functions.createExecution(
          input.functionId,
          input.body,
          false,
          input.path,
          input.method as ExecutionMethod | undefined,
        );
        return {
          $id: execution.$id,
          status: execution.status,
          responseBody: execution.responseBody,
        };
      } catch (error) {
        throw mapAppwriteError(error);
      }
    },
  };
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `pnpm vitest run packages/api-client/src/adapters/functions.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add packages/api-client/src/adapters/functions.ts packages/api-client/src/adapters/functions.test.ts
git commit -m "feat(api-client): add functions adapter"
```

---

## Task 8: Storage adapter

**Files:**
- Create: `packages/api-client/src/adapters/storage.ts`
- Test: `packages/api-client/src/adapters/storage.test.ts`

- [ ] **Step 1: Write the failing test**

Create `packages/api-client/src/adapters/storage.test.ts`:

```ts
import { AppwriteException, type Client } from "appwrite";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ApiError } from "../errors";
import { createStorageApi } from "./storage";

const mocks = vi.hoisted(() => ({
  storage: {
    getFilePreview: vi.fn(),
  },
}));

vi.mock("appwrite", async (importOriginal) => {
  const actual = await importOriginal<typeof import("appwrite")>();
  return { ...actual, Storage: vi.fn(function Storage() { return mocks.storage; }) };
});

const client = {} as Client;

beforeEach(() => {
  vi.clearAllMocks();
});

describe("createStorageApi", () => {
  it("returns the file preview url", () => {
    mocks.storage.getFilePreview.mockReturnValue("https://appwrite.example/preview.png");

    const api = createStorageApi(client);
    const url = api.getFilePreviewUrl({ bucketId: "b1", fileId: "f1", width: 64, height: 64 });

    expect(mocks.storage.getFilePreview).toHaveBeenCalledWith("b1", "f1", 64, 64);
    expect(url).toBe("https://appwrite.example/preview.png");
  });

  it("wraps failures in ApiError", () => {
    mocks.storage.getFilePreview.mockImplementation(() => {
      throw new AppwriteException("nope", 404, "file_not_found");
    });

    const api = createStorageApi(client);

    expect(() => api.getFilePreviewUrl({ bucketId: "b1", fileId: "f1" })).toThrow(ApiError);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm vitest run packages/api-client/src/adapters/storage.test.ts`
Expected: FAIL — cannot resolve `./storage`.

- [ ] **Step 3: Write the minimal implementation**

Create `packages/api-client/src/adapters/storage.ts`:

```ts
import { Storage } from "appwrite";
import type { Client } from "appwrite";

import type { StorageApi } from "../client";
import { mapAppwriteError } from "./map-error";

export function createStorageApi(client: Client): StorageApi {
  const storage = new Storage(client);

  return {
    getFilePreviewUrl(input): string {
      try {
        return storage.getFilePreview(
          input.bucketId,
          input.fileId,
          input.width,
          input.height,
        );
      } catch (error) {
        throw mapAppwriteError(error);
      }
    },
  };
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `pnpm vitest run packages/api-client/src/adapters/storage.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add packages/api-client/src/adapters/storage.ts packages/api-client/src/adapters/storage.test.ts
git commit -m "feat(api-client): add storage adapter"
```

---

## Task 9: Public factory and exports

**Files:**
- Create: `packages/api-client/src/adapters/appwrite.ts`
- Test: `packages/api-client/src/adapters/appwrite.test.ts`
- Modify: `packages/api-client/src/index.ts`

- [ ] **Step 1: Write the failing test**

Create `packages/api-client/src/adapters/appwrite.test.ts`:

```ts
import { describe, expect, it } from "vitest";

import { createAppwriteApiClient, createAppwriteServices } from "./appwrite";

const config = { endpoint: "https://appwrite.example/v1", projectId: "p1" };

describe("createAppwriteServices", () => {
  it("wires all five services", () => {
    const services = createAppwriteServices(config);

    expect(typeof services.account.getCurrentUser).toBe("function");
    expect(typeof services.teams.listTeams).toBe("function");
    expect(typeof services.databases.listDocuments).toBe("function");
    expect(typeof services.functions.createExecution).toBe("function");
    expect(typeof services.storage.getFilePreviewUrl).toBe("function");
  });
});

describe("createAppwriteApiClient", () => {
  it("exposes the validated config and the wired services", () => {
    const client = createAppwriteApiClient(config);

    expect(client.config).toEqual(config);
    expect(typeof client.account.getCurrentUser).toBe("function");
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm vitest run packages/api-client/src/adapters/appwrite.test.ts`
Expected: FAIL — cannot resolve `./appwrite`.

- [ ] **Step 3: Write the minimal implementation**

Create `packages/api-client/src/adapters/appwrite.ts`:

```ts
import type { ApiClient, AppwriteServices } from "../client";
import { createApiClient } from "../client";
import type { ApiClientConfig } from "../config";
import { createAccountApi } from "./account";
import { createAppwriteClient } from "./client";
import { createDatabasesApi } from "./databases";
import { createFunctionsApi } from "./functions";
import { createStorageApi } from "./storage";
import { createTeamsApi } from "./teams";

/** Builds the concrete Appwrite-backed services behind the api-client contracts. */
export function createAppwriteServices(config: ApiClientConfig): AppwriteServices {
  const client = createAppwriteClient(config);

  return {
    account: createAccountApi(client),
    teams: createTeamsApi(client),
    databases: createDatabasesApi(client),
    functions: createFunctionsApi(client),
    storage: createStorageApi(client),
  };
}

/** The ready-to-use client applications depend on. */
export function createAppwriteApiClient(config: ApiClientConfig): ApiClient {
  return createApiClient({ config, services: createAppwriteServices(config) });
}
```

- [ ] **Step 4: Export the factories from the package index**

Replace `packages/api-client/src/index.ts` with:

```ts
export * from "./client";
export * from "./config";
export * from "./dto";
export * from "./errors";
export * from "./query-client";
export { createAppwriteApiClient, createAppwriteServices } from "./adapters/appwrite";
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `pnpm vitest run packages/api-client/src/adapters/appwrite.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 6: Commit**

```bash
git add packages/api-client/src/adapters/appwrite.ts packages/api-client/src/adapters/appwrite.test.ts packages/api-client/src/index.ts
git commit -m "feat(api-client): expose appwrite-backed client factory"
```

---

## Task 10: Documentation and full verification

**Files:**
- Modify: `README.md:148-153`
- Modify: `docs/development/README.md:50-57`
- Modify: `TODO.md`

- [ ] **Step 1: Update the README deferred list**

In `README.md`, replace the `## Deferred (pending approval)` section body:

```markdown
## Deferred (pending approval)

- Sentry provider in `@cdorneles/observability`
- Production Appwrite roles, permissions, features and domains
- Business modules (customers, orders, invoices, …)
```

- [ ] **Step 2: Update the development docs deferred list**

In `docs/development/README.md`, replace the "Intentionally deferred" list:

```markdown
## Intentionally deferred

The Foundation deliberately stops short of these, pending explicit approval:

- the Sentry provider for `@cdorneles/observability`;
- Appwrite project ids, endpoints, domains and production roles/permissions;
- all business modules.
```

- [ ] **Step 3: Tick the adapter items in TODO.md**

In `TODO.md`, under `### 1. Appwrite SDK adapter (@cdorneles/api-client)`, mark every checkbox `[x]`:

```markdown
### 1. Appwrite SDK adapter (`@cdorneles/api-client`)

- [x] Authorize and add the `appwrite` SDK to the pnpm `catalog`
      (`pnpm-workspace.yaml`) and to `@cdorneles/api-client` dependencies.
- [x] Implement the concrete adapter behind the existing interfaces
      (`AccountApi`, `TeamsApi`, `DatabasesApi`, `FunctionsApi`, `StorageApi`).
- [x] Map Appwrite errors to `ApiError` (`toApiError`) with stable `code`s.
- [x] Keep the SDK out of app code: applications only ever use `createApiClient`.
- [x] Unit tests with a mocked SDK; no live network in tests.
```

- [ ] **Step 4: Run the full quality gate**

Run, in order:

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

Expected: all four exit 0. `pnpm test` includes the 22 new tests.

- [ ] **Step 5: Commit**

```bash
git add README.md docs/development/README.md TODO.md
git commit -m "docs: record appwrite adapter as implemented"
```

---

## Self-Review Notes

- **Spec coverage:** dependency (Task 1), error mapping (Task 2), client factory (Task 3), all five services (Tasks 4–8), public factories + exports (Task 9), docs/verification (Task 10). The spec's `.toString()` on `getFilePreview` is dropped because the v27 type is already `string`.
- **Type consistency:** every adapter returns the interface imported from `../client`; DTO field names match `../dto.ts` (`$id`, `email`, `name`, `status`, `userId`, `expire`, `teamId`, `roles`, `responseBody`).
- **No placeholders:** every step contains the code and command to run.
- **Vitest mock constructability (Task 4 finding):** `vi.mock` factories must return
  a **regular function** (e.g. `vi.fn(function Account() { return mocks.account; })`),
  not an arrow function. The adapters call `new Account(client)` and Vitest 5
  invokes the implementation with `new`, which throws `TypeError: ... is not a
  constructor` for an arrow. Tasks 4–8 use the regular-function form.
