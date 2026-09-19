# Storage & Messaging — Design Spec

**Date:** 2026-09-19
**Status:** Approved
**Scope:** Configure Appwrite Storage buckets, expand api-client StorageApi, add MessagingApi for transactional email

## Context

The Cdorneles Platform has Storage and Messaging as first-class Appwrite capabilities (ADR-003, ARCHITECTURE.md §4). Session 3 provisioned the database. This session adds Storage buckets and Messaging email support. Email providers are already configured in Appwrite.

## Non-Goals

- SMS/Push messaging — deferred to when needed
- UI upload components — this session only creates buckets and API adapters
- File virus scanning / image transformations — use Appwrite defaults
- Messaging topic/subscription management — deferred

## Storage

### Buckets (3)

| Bucket ID | Purpose | Max Size | Allowed Extensions | Permissions |
|---|---|---|---|---|
| `branding-logos` | Org logos (light/dark) + favicon | 5MB | image/png, image/jpeg, image/svg+xml, image/webp | org members read, admin write |
| `documents` | General documents (PDFs, sheets) | 50MB | application/pdf, text/*, image/* | org members read/write |
| `avatars` | User avatars | 2MB | image/png, image/jpeg, image/webp | any authenticated read, owner write |

### StorageApi Expansion

Current interface (`packages/api-client/src/client.ts`):
```ts
interface StorageApi {
  getFilePreviewUrl(input: { bucketId: string; fileId: string; width?: number; height?: number }): string;
}
```

Expanded interface:
```ts
interface StorageApi {
  getFilePreviewUrl(input: { bucketId: string; fileId: string; width?: number; height?: number }): string;
  uploadFile(input: { bucketId: string; fileId: string; file: File | Blob }): Promise<AppwriteFile>;
  deleteFile(input: { bucketId: string; fileId: string }): Promise<void>;
  listFiles(input: { bucketId: string; queries?: string[] }): Promise<AppwriteFile[]>;
  getFileDownloadUrl(input: { bucketId: string; fileId: string }): string;
  getFileViewUrl(input: { bucketId: string; fileId: string }): string;
}
```

### New DTO: AppwriteFile

```ts
interface AppwriteFile {
  $id: string;
  $createdAt: string;
  $updatedAt: string;
  bucketId: string;
  name: string;
  mimeType: string;
  sizeOriginal: number;
}
```

### Logo Upload Flow

1. User selects image in org settings
2. Frontend calls `storage.uploadFile({ bucketId: "branding-logos", fileId: `${orgId}-light`, file })`
3. Returned URL saved to `organization_profiles.logoLight`

## Messaging

### MessagingApi (New)

```ts
interface MessagingApi {
  sendEmail(input: {
    subject: string;
    content: string;
    recipientType: "users" | "topics";
    userIds?: string[];
    topicIds?: string[];
  }): Promise<AppwriteMessage>;
}
```

### New DTO: AppwriteMessage

```ts
interface AppwriteMessage {
  $id: string;
  status: string;
  deliveredAt?: string;
}
```

### AppwriteServices Wire

```ts
interface AppwriteServices {
  account: AccountApi;
  teams: TeamsApi;
  tables: TablesApi;
  functions: FunctionsApi;
  storage: StorageApi;
  messaging: MessagingApi;  // NEW
}
```

## Files Created/Modified

| File | Change |
|---|---|
| `packages/api-client/src/dto.ts` | Add `AppwriteFile`, `AppwriteMessage` |
| `packages/api-client/src/client.ts` | Expand `StorageApi`, add `MessagingApi`, expand `AppwriteServices` |
| `packages/api-client/src/adapters/storage.ts` | Add upload, delete, list, download, view methods |
| `packages/api-client/src/adapters/messaging.ts` | **New** — `createMessagingApi` |
| `packages/api-client/src/adapters/appwrite.ts` | Add `messaging` to `createAppwriteServices` |
| `packages/provisioning/src/config.ts` | Add `STORAGE_BUCKETS` constant |
| `packages/provisioning/src/buckets.ts` | **New** — create buckets via node-appwrite |
| `packages/api-client/src/adapters/storage.test.ts` | Add ~8 new tests |
| `packages/api-client/src/adapters/messaging.test.ts` | **New** — ~4 tests |
| `packages/provisioning/src/__tests__/buckets.test.ts` | **New** — ~5 tests |

## Validation

After implementation:

- `pnpm lint` — 0 errors, 0 warnings
- `pnpm typecheck` — exit 0
- `pnpm test` — all tests pass (existing + new)
- `pnpm build` — exit 0
- `pnpm provision` — creates buckets alongside existing database/tables
