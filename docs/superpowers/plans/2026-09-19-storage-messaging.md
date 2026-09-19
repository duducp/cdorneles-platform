# Storage & Messaging — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add Storage buckets (branding-logos, documents, avatars) to provisioning and expand the api-client StorageApi.

**Architecture:** Expand existing `StorageApi` with upload/delete/list/download/view methods and provision 3 storage buckets via node-appwrite. Email is out of scope: it belongs in an Appwrite Function (see spec revision) because browser `appwrite@27.0.0` has no `createEmail`.

**Tech Stack:** node-appwrite, TypeScript, Vitest.

---

## File Structure

| File | Responsibility |
|---|---|
| `packages/api-client/src/dto.ts` | Add `AppwriteFile` DTO |
| `packages/api-client/src/client.ts` | Expand `StorageApi` |
| `packages/api-client/src/adapters/storage.ts` | Add upload, delete, list, download, view methods |
| `packages/provisioning/src/config.ts` | Add `STORAGE_BUCKETS` constant |
| `packages/provisioning/src/client.ts` | Shared `AppwriteConfig` + `createClient` |
| `packages/provisioning/src/buckets.ts` | **New** — create buckets via node-appwrite |
| `packages/api-client/src/adapters/storage.test.ts` | Add ~8 new tests |
| `packages/provisioning/src/__tests__/buckets.test.ts` | **New** — ~5 tests |

---

### Task 1: Add AppwriteFile DTO

**Files:**
- Modify: `packages/api-client/src/dto.ts`

- [ ] **Step 1: Add AppwriteFile interface**

Add at the end of `packages/api-client/src/dto.ts`:

```ts
export interface AppwriteFile {
  $id: string;
  $createdAt: string;
  $updatedAt: string;
  bucketId: string;
  name: string;
  mimeType: string;
  sizeOriginal: number;
}
```

- [ ] **Step 2: Commit**

```bash
git add packages/api-client/src/dto.ts
git commit -m "feat(api-client): add AppwriteFile DTO"
```

---

### Task 2: Expand StorageApi interface

**Files:**
- Modify: `packages/api-client/src/client.ts`

- [ ] **Step 1: Import AppwriteFile**

Add `AppwriteFile` to the existing type import from `./dto`:

```ts
import type {
  AppwriteAccount,
  AppwriteExecution,
  AppwriteFile,
  AppwriteMembership,
  AppwriteRow,
  AppwriteSession,
  AppwriteTeam,
} from "./dto";
```

- [ ] **Step 2: Expand StorageApi interface**

Replace the existing `StorageApi` in `packages/api-client/src/client.ts`:

```ts
export interface StorageApi {
  getFilePreviewUrl(input: {
    bucketId: string;
    fileId: string;
    width?: number;
    height?: number;
  }): string;
  uploadFile(input: {
    bucketId: string;
    fileId: string;
    file: File;
    permissions?: string[];
  }): Promise<AppwriteFile>;
  deleteFile(input: {
    bucketId: string;
    fileId: string;
  }): Promise<void>;
  listFiles(input: {
    bucketId: string;
    queries?: string[];
  }): Promise<AppwriteFile[]>;
  getFileDownloadUrl(input: {
    bucketId: string;
    fileId: string;
  }): string;
  getFileViewUrl(input: {
    bucketId: string;
    fileId: string;
  }): string;
}
```

`AppwriteServices` is unchanged — no `messaging` field is added.

- [ ] **Step 3: Commit**

```bash
git add packages/api-client/src/client.ts
git commit -m "feat(api-client): expand StorageApi with upload, delete, list, download, view"
```

---

### Task 3: Expand storage adapter

**Files:**
- Modify: `packages/api-client/src/adapters/storage.ts`

- [ ] **Step 1: Read the existing adapter**

Read `packages/api-client/src/adapters/storage.ts` first to confirm the current imports and `createStorageApi` shape.

- [ ] **Step 2: Expand storage adapter with all new methods**

Replace the full content of `packages/api-client/src/adapters/storage.ts`:

```ts
import type { Client } from "appwrite";
import { Storage as AppwriteStorage } from "appwrite";
import type { StorageApi } from "../client.js";
import { toApiError, type ApiError } from "../errors.js";

function createStorage(client: Client): AppwriteStorage {
  return new AppwriteStorage(client);
}

function handleError(error: unknown): ApiError {
  return toApiError(error);
}

export function createStorageApi(client: Client): StorageApi {
  const storage = createStorage(client);

  return {
    getFilePreviewUrl(input) {
      const url = storage.getFilePreview(
        input.bucketId,
        input.fileId,
        input.width ?? 0,
        input.height ?? 0,
      );
      return typeof url === "string" ? url : url.href;
    },

    async uploadFile(input) {
      try {
        const result = await storage.createFile({
          bucketId: input.bucketId,
          fileId: input.fileId,
          file: input.file,
          permissions: input.permissions,
        });
        return {
          $id: result.$id,
          $createdAt: result.$createdAt,
          $updatedAt: result.$updatedAt,
          bucketId: result.bucketId,
          name: result.name,
          mimeType: result.mimeType,
          sizeOriginal: result.sizeOriginal,
        };
      } catch (error) {
        throw handleError(error);
      }
    },

    async deleteFile(input) {
      try {
        await storage.deleteFile(input.bucketId, input.fileId);
      } catch (error) {
        throw handleError(error);
      }
    },

    async listFiles(input) {
      try {
        const result = await storage.listFiles(input.bucketId, input.queries);
        return result.files.map((file) => ({
          $id: file.$id,
          $createdAt: file.$createdAt,
          $updatedAt: file.$updatedAt,
          bucketId: file.bucketId,
          name: file.name,
          mimeType: file.mimeType,
          sizeOriginal: file.sizeOriginal,
        }));
      } catch (error) {
        throw handleError(error);
      }
    },

    getFileDownloadUrl(input) {
      const url = storage.getFileDownload(input.bucketId, input.fileId);
      return typeof url === "string" ? url : url.href;
    },

    getFileViewUrl(input) {
      const url = storage.getFileView(input.bucketId, input.fileId);
      return typeof url === "string" ? url : url.href;
    },
  };
}
```

- [ ] **Step 3: Typecheck the package**

```bash
pnpm --filter @cdorneles/api-client typecheck
```

Expected: exit 0. If `storage.listFiles` or URL helpers have different signatures in `appwrite@27.0.0`, adjust the calls to match the actual SDK types and note it in your report.

- [ ] **Step 4: Commit**

```bash
git add packages/api-client/src/adapters/storage.ts
git commit -m "feat(api-client): expand storage adapter with upload, delete, list, download, view"
```

---

### Task 4: Add storage tests

**Files:**
- Modify: `packages/api-client/src/adapters/storage.test.ts`

- [ ] **Step 1: Read the existing test file**

Read `packages/api-client/src/adapters/storage.test.ts` to learn the existing `vi.mock("appwrite", ...)` factory shape and how `storageApi` is constructed in `beforeEach`.

- [ ] **Step 2: Extend the appwrite mock with the new methods**

In the existing `vi.mock("appwrite", ...)` factory, add a `Storage` class mock exposing: `getFilePreview`, `createFile`, `deleteFile`, `listFiles`, `getFileDownload`, `getFileView`. Keep the existing `getFilePreview` behavior. Example shape (adapt names to the existing file's conventions):

```ts
const mockCreateFile = vi.fn().mockResolvedValue({
  $id: "test-file-id",
  $createdAt: "2026-01-01T00:00:00.000Z",
  $updatedAt: "2026-01-01T00:00:00.000Z",
  bucketId: "branding-logos",
  name: "test.png",
  mimeType: "image/png",
  sizeOriginal: 4,
});
const mockDeleteFile = vi.fn().mockResolvedValue(undefined);
const mockListFiles = vi.fn().mockResolvedValue({
  files: [
    {
      $id: "test-file-id",
      $createdAt: "2026-01-01T00:00:00.000Z",
      $updatedAt: "2026-01-01T00:00:00.000Z",
      bucketId: "branding-logos",
      name: "test.png",
      mimeType: "image/png",
      sizeOriginal: 4,
    },
  ],
});
const mockGetFileDownload = vi.fn().mockReturnValue("https://example.test/download");
const mockGetFileView = vi.fn().mockReturnValue("https://example.test/view");
```

- [ ] **Step 3: Add tests for the new storage methods**

Append these test cases, reusing the file's existing `storageApi` instance:

```ts
describe("uploadFile", () => {
  it("uploads file and returns AppwriteFile", async () => {
    const mockFile = new File(["test"], "test.png", { type: "image/png" });
    const result = await storageApi.uploadFile({
      bucketId: "branding-logos",
      fileId: "org-1-light",
      file: mockFile,
    });
    expect(result.$id).toBe("test-file-id");
    expect(result.bucketId).toBe("branding-logos");
  });

  it("wraps errors as ApiError", async () => {
    mockCreateFile.mockRejectedValueOnce(new Error("fail"));
    await expect(
      storageApi.uploadFile({
        bucketId: "test",
        fileId: "test",
        file: new File([""], "test"),
      }),
    ).rejects.toThrow();
  });
});

describe("deleteFile", () => {
  it("deletes file successfully", async () => {
    await expect(
      storageApi.deleteFile({ bucketId: "test", fileId: "test-id" }),
    ).resolves.not.toThrow();
  });

  it("wraps errors as ApiError", async () => {
    mockDeleteFile.mockRejectedValueOnce(new Error("fail"));
    await expect(
      storageApi.deleteFile({ bucketId: "test", fileId: "test" }),
    ).rejects.toThrow();
  });
});

describe("listFiles", () => {
  it("lists files and returns AppwriteFile[]", async () => {
    const result = await storageApi.listFiles({ bucketId: "test" });
    expect(Array.isArray(result)).toBe(true);
    expect(result[0].$id).toBe("test-file-id");
  });
});

describe("getFileDownloadUrl", () => {
  it("returns download URL string", () => {
    const url = storageApi.getFileDownloadUrl({
      bucketId: "test",
      fileId: "test-id",
    });
    expect(typeof url).toBe("string");
  });
});

describe("getFileViewUrl", () => {
  it("returns view URL string", () => {
    const url = storageApi.getFileViewUrl({
      bucketId: "test",
      fileId: "test-id",
    });
    expect(typeof url).toBe("string");
  });
});
```

- [ ] **Step 4: Run tests**

```bash
pnpm --filter @cdorneles/api-client test src/adapters/storage.test.ts
```

Expected: PASS (existing + new).

- [ ] **Step 5: Commit**

```bash
git add packages/api-client/src/adapters/storage.test.ts
git commit -m "test(api-client): add storage upload, delete, list, download, view tests"
```

---

### Task 5: Add STORAGE_BUCKETS to provisioning config

**Files:**
- Modify: `packages/provisioning/src/config.ts`

- [ ] **Step 1: Add STORAGE_BUCKETS constant**

Add at the end of `packages/provisioning/src/config.ts`:

```ts
export interface BucketDef {
  id: string;
  name: string;
  maxSize: number;
  allowedFileExtensions: string[];
}

export const STORAGE_BUCKETS: BucketDef[] = [
  {
    id: "branding-logos",
    name: "Branding Logos",
    maxSize: 5 * 1024 * 1024,
    allowedFileExtensions: ["png", "jpg", "jpeg", "svg", "webp"],
  },
  {
    id: "documents",
    name: "Documents",
    maxSize: 30_000_000,
    allowedFileExtensions: [
      "pdf",
      "txt",
      "csv",
      "doc",
      "docx",
      "xls",
      "xlsx",
      "png",
      "jpg",
      "jpeg",
      "webp",
    ],
  },
  {
    id: "avatars",
    name: "Avatars",
    maxSize: 2 * 1024 * 1024,
    allowedFileExtensions: ["png", "jpg", "jpeg", "webp"],
  },
];
```

- [ ] **Step 2: Commit**

```bash
git add packages/provisioning/src/config.ts
git commit -m "feat(provisioning): add STORAGE_BUCKETS constant"
```

---

### Task 6: Create buckets provisioning

**Files:**
- Create: `packages/provisioning/src/buckets.ts`
- Modify: `packages/provisioning/src/index.ts`

- [ ] **Step 1: Read existing provisioning sources**

Read `packages/provisioning/src/database.ts`, `packages/provisioning/src/config.ts`, and `packages/provisioning/src/index.ts` to match the existing client-construction, config type, logging, and export conventions.

- [ ] **Step 2: Create buckets.ts**

Create `packages/provisioning/src/buckets.ts`. Reuse `DatabaseConfig` from `./database.js` (the package's canonical config shape; `index.ts` aliases it as `ProvisioningConfig`). Match the client-construction and logging style of `database.ts`:

```ts
import { Client, Storage } from "node-appwrite";
import { STORAGE_BUCKETS } from "./config.js";
import type { DatabaseConfig } from "./database.js";

function createStorageApi(config: DatabaseConfig): Storage {
  const client = new Client()
    .setEndpoint(config.endpoint)
    .setProject(config.projectId)
    .setKey(config.apiKey);
  return new Storage(client);
}

export async function createBuckets(config: DatabaseConfig): Promise<void> {
  const storage = createStorageApi(config);

  for (const bucket of STORAGE_BUCKETS) {
    console.log(`[provisioning] Creating bucket: ${bucket.id}`);

    try {
      await storage.createBucket(
        bucket.id,
        bucket.name,
        [],
        true,
        true,
        bucket.maxSize,
        bucket.allowedFileExtensions,
      );
      console.log(`[provisioning] Bucket ${bucket.id} created.`);
    } catch (error: unknown) {
      const code = (error as { code?: number }).code;
      if (code === 409) {
        console.log(
          `[provisioning] Bucket ${bucket.id} already exists, skipping.`,
        );
      } else {
        throw error;
      }
    }
  }
}
```

`permissions: []` is deliberate (deny by default) and `fileSecurity: true` enables per-file permissions. Per-file read/write permissions are set at upload time by the application/Function, not statically provisioned. `createBucket` in `node-appwrite@17` is positional-only.

- [ ] **Step 3: Wire into index.ts**

In `packages/provisioning/src/index.ts`, add the export and call `createBuckets` inside `runProvisioning`:

```ts
export { createBuckets } from "./buckets.js";
export { STORAGE_BUCKETS } from "./config.js";
export type { BucketDef } from "./config.js";
```

```ts
import { createBuckets } from "./buckets.js";

export async function runProvisioning(
  config: ProvisioningConfig,
): Promise<void> {
  console.log("[provisioning] Starting provisioning...");

  await createDatabase(config);
  await seedData(config);
  await createBuckets(config);

  console.log("[provisioning] Provisioning complete.");
}
```

Match the actual existing `runProvisioning` body — only add the `createBuckets` import and call.

- [ ] **Step 4: Typecheck**

```bash
pnpm --filter @cdorneles/provisioning typecheck
```

Expected: exit 0. Verify `createBucket`'s positional signature against `node-appwrite@17.2.0`; adjust if the SDK differs.

- [ ] **Step 5: Commit**

```bash
git add packages/provisioning/src/buckets.ts packages/provisioning/src/index.ts
git commit -m "feat(provisioning): add bucket provisioning"
```

---

### Task 7: Add buckets tests

**Files:**
- Create: `packages/provisioning/src/__tests__/buckets.test.ts`

- [ ] **Step 1: Read an existing provisioning test**

Read `packages/provisioning/src/__tests__/database.test.ts` to copy its `vi.mock("node-appwrite", ...)` factory style (remember: `vi.mock` factory constructors must be regular functions, not arrow functions).

- [ ] **Step 2: Create buckets test file**

Create `packages/provisioning/src/__tests__/buckets.test.ts`, matching the existing test file's mock and import conventions:

```ts
import { describe, it, expect, vi, beforeEach } from "vitest";

const mockCreateBucket = vi.fn().mockResolvedValue({ $id: "test" });

vi.mock("node-appwrite", () => ({
  Client: vi.fn().mockImplementation(function () {
    return {
      setEndpoint: vi.fn().mockReturnThis(),
      setProject: vi.fn().mockReturnThis(),
      setKey: vi.fn().mockReturnThis(),
    };
  }),
  Storage: vi.fn().mockImplementation(function () {
    return { createBucket: mockCreateBucket };
  }),
}));

import { createBuckets } from "../buckets.js";

describe("createBuckets", () => {
  const config = {
    endpoint: "https://test.appwrite.io/v1",
    projectId: "test-project",
    apiKey: "test-api-key",
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockCreateBucket.mockResolvedValue({ $id: "test" });
  });

  it("is a function", () => {
    expect(typeof createBuckets).toBe("function");
  });

  it("creates 3 buckets", async () => {
    await createBuckets(config as never);
    expect(mockCreateBucket).toHaveBeenCalledTimes(3);
  });

  it("handles 409 conflict (bucket already exists)", async () => {
    mockCreateBucket.mockRejectedValue({ code: 409 });
    await expect(createBuckets(config as never)).resolves.not.toThrow();
  });

  it("propagates non-409 errors", async () => {
    mockCreateBucket.mockRejectedValue({ code: 500 });
    await expect(createBuckets(config as never)).rejects.toThrow();
  });
});
```

Adapt the `config as never` cast to the real `ProvisioningConfig` type if it is exported and importable.

- [ ] **Step 3: Run tests**

```bash
pnpm --filter @cdorneles/provisioning test src/__tests__/buckets.test.ts
```

Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add packages/provisioning/src/__tests__/buckets.test.ts
git commit -m "test(provisioning): add bucket creation tests"
```

---

### Task 8: Run verification gates

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
| 1 | Add AppwriteFile DTO | TODO |
| 2 | Expand StorageApi interface | TODO |
| 3 | Expand storage adapter | TODO |
| 4 | Add storage tests | TODO |
| 5 | Add STORAGE_BUCKETS to provisioning config | TODO |
| 6 | Create buckets provisioning | TODO |
| 7 | Add buckets tests | TODO |
| 8 | Run verification gates | TODO |
