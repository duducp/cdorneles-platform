# Storage & Messaging — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add Storage buckets (branding-logos, documents, avatars) and Messaging email support to the api-client and provisioning packages.

**Architecture:** Expand existing `StorageApi` with upload/delete/list/download/view methods, create new `MessagingApi` for email, provision 3 storage buckets via node-appwrite.

**Tech Stack:** node-appwrite, TypeScript, Vitest.

---

## File Structure

| File | Responsibility |
|---|---|
| `packages/api-client/src/dto.ts` | Add `AppwriteFile`, `AppwriteMessage` DTOs |
| `packages/api-client/src/client.ts` | Expand `StorageApi`, add `MessagingApi`, expand `AppwriteServices` |
| `packages/api-client/src/adapters/storage.ts` | Add upload, delete, list, download, view methods |
| `packages/api-client/src/adapters/messaging.ts` | **New** — `createMessagingApi` |
| `packages/api-client/src/adapters/appwrite.ts` | Add `messaging` to `createAppwriteServices` |
| `packages/provisioning/src/config.ts` | Add `STORAGE_BUCKETS` constant |
| `packages/provisioning/src/buckets.ts` | **New** — create buckets via node-appwrite |
| `packages/api-client/src/adapters/storage.test.ts` | Add ~8 new tests |
| `packages/api-client/src/adapters/messaging.test.ts` | **New** — ~4 tests |
| `packages/provisioning/src/__tests__/buckets.test.ts` | **New** — ~5 tests |

---

### Task 1: Add DTOs to dto.ts

**Files:**
- Modify: `packages/api-client/src/dto.ts`

- [ ] **Step 1: Add AppwriteFile and AppwriteMessage interfaces**

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

export interface AppwriteMessage {
  $id: string;
  status: string;
  deliveredAt?: string;
}
```

- [ ] **Step 2: Commit**

```bash
git add packages/api-client/src/dto.ts
git commit -m "feat(api-client): add AppwriteFile and AppwriteMessage DTOs"
```

---

### Task 2: Expand StorageApi and add MessagingApi interfaces

**Files:**
- Modify: `packages/api-client/src/client.ts`

- [ ] **Step 1: Expand StorageApi interface**

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
    file: File | Blob;
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

- [ ] **Step 2: Add MessagingApi interface**

Add after `StorageApi`:

```ts
export interface MessagingApi {
  sendEmail(input: {
    subject: string;
    content: string;
    recipientType: "users" | "topics";
    userIds?: string[];
    topicIds?: string[];
  }): Promise<AppwriteMessage>;
}
```

- [ ] **Step 3: Expand AppwriteServices interface**

Add `messaging` to `AppwriteServices`:

```ts
export interface AppwriteServices {
  account: AccountApi;
  teams: TeamsApi;
  tables: TablesApi;
  functions: FunctionsApi;
  storage: StorageApi;
  messaging: MessagingApi;
}
```

- [ ] **Step 4: Commit**

```bash
git add packages/api-client/src/client.ts
git commit -m "feat(api-client): expand StorageApi, add MessagingApi, update AppwriteServices"
```

---

### Task 3: Expand storage adapter

**Files:**
- Modify: `packages/api-client/src/adapters/storage.ts`

- [ ] **Step 1: Expand storage adapter with all new methods**

Read the existing file first, then expand. The existing `createStorageApi` returns `{ getFilePreviewUrl }`. Expand to include all new methods.

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
        const result = await storage.createFile(
          input.bucketId,
          input.fileId,
          input.file,
        );
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
        const result = await storage.listFiles(
          input.bucketId,
          input.queries,
        );
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

- [ ] **Step 2: Commit**

```bash
git add packages/api-client/src/adapters/storage.ts
git commit -m "feat(api-client): expand storage adapter with upload, delete, list, download, view"
```

---

### Task 4: Create messaging adapter

**Files:**
- Create: `packages/api-client/src/adapters/messaging.ts`

- [ ] **Step 1: Create messaging adapter**

Create `packages/api-client/src/adapters/messaging.ts`:

```ts
import type { Client } from "appwrite";
import { Messaging as AppwriteMessaging } from "appwrite";
import type { MessagingApi } from "../client.js";
import { toApiError } from "../errors.js";

function createMessaging(client: Client): AppwriteMessaging {
  return new AppwriteMessaging(client);
}

export function createMessagingApi(client: Client): MessagingApi {
  const messaging = createMessaging(client);

  return {
    async sendEmail(input) {
      try {
        const result = await messaging.createEmail(
          "unique()",
          input.subject,
          input.content,
          undefined, // cc
          undefined, // bcc
          undefined, // attachments
          undefined, // draft
          undefined, // html
          undefined, // scheduledAt
        );
        return {
          $id: result.$id,
          status: result.status,
          deliveredAt: result.deliveredAt,
        };
      } catch (error) {
        throw toApiError(error);
      }
    },
  };
}
```

- [ ] **Step 2: Commit**

```bash
git add packages/api-client/src/adapters/messaging.ts
git commit -m "feat(api-client): create messaging adapter with sendEmail"
```

---

### Task 5: Wire messaging into appwrite.ts

**Files:**
- Modify: `packages/api-client/src/adapters/appwrite.ts`

- [ ] **Step 1: Import and wire messaging**

Add import and wire into `createAppwriteServices`:

```ts
import { createMessagingApi } from "./messaging.js";
```

Add to the return object:

```ts
export function createAppwriteServices(config: ApiClientConfig): AppwriteServices {
  const client = createAppwriteClient(config);
  return {
    account: createAccountApi(client),
    teams: createTeamsApi(client),
    tables: createTablesApi(client),
    functions: createFunctionsApi(client),
    storage: createStorageApi(client),
    messaging: createMessagingApi(client),
  };
}
```

- [ ] **Step 2: Commit**

```bash
git add packages/api-client/src/adapters/appwrite.ts
git commit -m "feat(api-client): wire messaging into createAppwriteServices"
```

---

### Task 6: Add storage tests

**Files:**
- Modify: `packages/api-client/src/adapters/storage.test.ts`

- [ ] **Step 1: Read existing test file**

Read `packages/api-client/src/adapters/storage.test.ts` to understand existing mock patterns.

- [ ] **Step 2: Add tests for new storage methods**

Add tests after the existing ones. Follow the same mock pattern (mock `appwrite` module, test each method).

Add these test cases:

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
      storageApi.uploadFile({ bucketId: "test", fileId: "test", file: new File([""], "test") }),
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
    const url = storageApi.getFileDownloadUrl({ bucketId: "test", fileId: "test-id" });
    expect(typeof url).toBe("string");
  });
});

describe("getFileViewUrl", () => {
  it("returns view URL string", () => {
    const url = storageApi.getFileViewUrl({ bucketId: "test", fileId: "test-id" });
    expect(typeof url).toBe("string");
  });
});
```

- [ ] **Step 3: Update mock setup to include new methods**

In the mock factory, add mocks for `createFile`, `deleteFile`, `listFiles`, `getFileDownload`, `getFileView`.

- [ ] **Step 4: Run tests**

```bash
cd packages/api-client && pnpm test src/adapters/storage.test.ts
```

- [ ] **Step 5: Commit**

```bash
git add packages/api-client/src/adapters/storage.test.ts
git commit -m "test(api-client): add storage upload, delete, list, download, view tests"
```

---

### Task 7: Create messaging tests

**Files:**
- Create: `packages/api-client/src/adapters/messaging.test.ts`

- [ ] **Step 1: Create messaging test file**

Create `packages/api-client/src/adapters/messaging.test.ts` following the same pattern as other adapter tests:

```ts
import { describe, it, expect, vi, beforeEach } from "vitest";

const mockCreateEmail = vi.fn().mockResolvedValue({
  $id: "msg-123",
  status: "queued",
  deliveredAt: undefined,
});

vi.mock("appwrite", () => ({
  Messaging: vi.fn().mockImplementation(() => ({
    createEmail: mockCreateEmail,
  })),
}));

import { createMessagingApi } from "./messaging.js";

function createMockClient() {
  return { setEndpoint: vi.fn().mockReturnThis(), setProject: vi.fn().mockReturnThis() } as never;
}

describe("createMessagingApi", () => {
  let messagingApi: ReturnType<typeof createMessagingApi>;

  beforeEach(() => {
    vi.clearAllMocks();
    messagingApi = createMessagingApi(createMockClient());
  });

  it("is a function", () => {
    expect(typeof createMessagingApi).toBe("function");
  });

  describe("sendEmail", () => {
    it("sends email and returns AppwriteMessage", async () => {
      const result = await messagingApi.sendEmail({
        subject: "Welcome",
        content: "<p>Hello</p>",
        recipientType: "users",
        userIds: ["user-1"],
      });
      expect(result.$id).toBe("msg-123");
      expect(result.status).toBe("queued");
    });

    it("wraps errors as ApiError", async () => {
      mockCreateEmail.mockRejectedValueOnce(new Error("fail"));
      await expect(
        messagingApi.sendEmail({ subject: "Test", content: "Test", recipientType: "users" }),
      ).rejects.toThrow();
    });
  });
});
```

- [ ] **Step 2: Run tests**

```bash
cd packages/api-client && pnpm test src/adapters/messaging.test.ts
```

- [ ] **Step 3: Commit**

```bash
git add packages/api-client/src/adapters/messaging.test.ts
git commit -m "test(api-client): add messaging sendEmail tests"
```

---

### Task 8: Add STORAGE_BUCKETS to provisioning config

**Files:**
- Modify: `packages/provisioning/src/config.ts`

- [ ] **Step 1: Add STORAGE_BUCKETS constant**

Add at the end of `packages/provisioning/src/config.ts`:

```ts
export interface BucketDef {
  id: string;
  name: string;
  maxSize: number;
  allowedExtensions: string[];
}

export const STORAGE_BUCKETS: BucketDef[] = [
  {
    id: "branding-logos",
    name: "Branding Logos",
    maxSize: 5 * 1024 * 1024,
    allowedExtensions: ["image/png", "image/jpeg", "image/svg+xml", "image/webp"],
  },
  {
    id: "documents",
    name: "Documents",
    maxSize: 50 * 1024 * 1024,
    allowedExtensions: ["application/pdf", "text/*", "image/*"],
  },
  {
    id: "avatars",
    name: "Avatars",
    maxSize: 2 * 1024 * 1024,
    allowedExtensions: ["image/png", "image/jpeg", "image/webp"],
  },
];
```

- [ ] **Step 2: Commit**

```bash
git add packages/provisioning/src/config.ts
git commit -m "feat(provisioning): add STORAGE_BUCKETS constant"
```

---

### Task 9: Create buckets provisioning

**Files:**
- Create: `packages/provisioning/src/buckets.ts`
- Modify: `packages/provisioning/src/index.ts`

- [ ] **Step 1: Create buckets.ts**

Create `packages/provisioning/src/buckets.ts`:

```ts
import { Client, Storage } from "node-appwrite";
import { STORAGE_BUCKETS, type BucketDef } from "./config.js";

interface BucketConfig {
  endpoint: string;
  projectId: string;
  apiKey: string;
}

function createStorageApi(config: BucketConfig): Storage {
  const client = new Client()
    .setEndpoint(config.endpoint)
    .setProject(config.projectId)
    .setKey(config.apiKey);
  return new Storage(client);
}

export async function createBuckets(config: BucketConfig): Promise<void> {
  const storage = createStorageApi(config);

  for (const bucket of STORAGE_BUCKETS) {
    console.log(`[provisioning] Creating bucket: ${bucket.id}`);

    try {
      await storage.createBucket(
        bucket.id,
        bucket.name,
        "bucket", // permissions
        true, // fileSecurity
        true, // enabled
        bucket.maxSize,
        bucket.allowedExtensions,
      );
      console.log(`[provisioning] Bucket ${bucket.id} created.`);
    } catch (error: unknown) {
      const code = (error as { code?: number }).code;
      if (code === 409) {
        console.log(`[provisioning] Bucket ${bucket.id} already exists, skipping.`);
      } else {
        throw error;
      }
    }
  }
}
```

- [ ] **Step 2: Wire into index.ts**

Add to `packages/provisioning/src/index.ts`:

```ts
export { createBuckets } from "./buckets.js";
export { STORAGE_BUCKETS } from "./config.js";
export type { BucketDef } from "./config.js";
```

Add `createBuckets` call to `runProvisioning`:

```ts
import { createBuckets } from "./buckets.js";

export async function runProvisioning(config: ProvisioningConfig): Promise<void> {
  console.log("[provisioning] Starting provisioning...");

  await createDatabase(config);
  await seedData(config);
  await createBuckets(config);

  console.log("[provisioning] Provisioning complete.");
}
```

- [ ] **Step 3: Commit**

```bash
git add packages/provisioning/src/buckets.ts packages/provisioning/src/index.ts
git commit -m "feat(provisioning): add bucket provisioning"
```

---

### Task 10: Add buckets tests

**Files:**
- Create: `packages/provisioning/src/__tests__/buckets.test.ts`

- [ ] **Step 1: Create buckets test file**

Create `packages/provisioning/src/__tests__/buckets.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("node-appwrite", () => {
  const mockCreateBucket = vi.fn().mockResolvedValue({ $id: "test" });

  return {
    Client: vi.fn().mockImplementation(() => ({
      setEndpoint: vi.fn().mockReturnThis(),
      setProject: vi.fn().mockReturnThis(),
      setKey: vi.fn().mockReturnThis(),
    })),
    Storage: vi.fn().mockImplementation(() => ({
      createBucket: mockCreateBucket,
    })),
  };
});

import { createBuckets } from "../buckets.js";

describe("createBuckets", () => {
  const config = {
    endpoint: "https://test.appwrite.io/v1",
    projectId: "test-project",
    apiKey: "test-api-key",
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("is a function", () => {
    expect(typeof createBuckets).toBe("function");
  });

  it("creates 3 buckets", async () => {
    const { Storage } = await import("node-appwrite");
    const mockInstance = new (Storage as unknown as new () => { createBucket: ReturnType<typeof vi.fn> })();

    await createBuckets(config);

    expect(mockInstance.createBucket).toHaveBeenCalledTimes(3);
  });

  it("handles 409 conflict (bucket already exists)", async () => {
    const { Storage } = await import("node-appwrite");
    const mockInstance = new (Storage as unknown as new () => { createBucket: ReturnType<typeof vi.fn> })();
    mockInstance.createBucket.mockRejectedValue({ code: 409 });

    await expect(createBuckets(config)).resolves.not.toThrow();
  });

  it("propagates non-409 errors", async () => {
    const { Storage } = await import("node-appwrite");
    const mockInstance = new (Storage as unknown as new () => { createBucket: ReturnType<typeof vi.fn> })();
    mockInstance.createBucket.mockRejectedValue({ code: 500 });

    await expect(createBuckets(config)).rejects.toThrow();
  });
});
```

- [ ] **Step 2: Run tests**

```bash
cd packages/provisioning && pnpm test src/__tests__/buckets.test.ts
```

- [ ] **Step 3: Commit**

```bash
git add packages/provisioning/src/__tests__/buckets.test.ts
git commit -m "test(provisioning): add bucket creation tests"
```

---

### Task 11: Run verification gates

- [ ] **Step 1: Lint**

```bash
pnpm lint
```

- [ ] **Step 2: Typecheck**

```bash
pnpm typecheck
```

- [ ] **Step 3: Tests**

```bash
pnpm test
```

- [ ] **Step 4: Build**

```bash
pnpm build
```

- [ ] **Step 5: Fix any issues and commit**

```bash
git add -A
git commit -m "fix: address verification gate issues"
```

---

## Summary

| Task | Description | Status |
|---|---|---|
| 1 | Add DTOs to dto.ts | TODO |
| 2 | Expand StorageApi and add MessagingApi interfaces | TODO |
| 3 | Expand storage adapter | TODO |
| 4 | Create messaging adapter | TODO |
| 5 | Wire messaging into appwrite.ts | TODO |
| 6 | Add storage tests | TODO |
| 7 | Create messaging tests | TODO |
| 8 | Add STORAGE_BUCKETS to provisioning config | TODO |
| 9 | Create buckets provisioning | TODO |
| 10 | Add buckets tests | TODO |
| 11 | Run verification gates | TODO |
