# Storage & Messaging — Design Spec

**Date:** 2026-09-19
**Status:** Approved (Messaging scope revised)
**Scope:** Configure Appwrite Storage buckets and expand api-client StorageApi. Email is deferred to Appwrite Functions.

## Context

The Cdorneles Platform has Storage and Messaging as first-class Appwrite capabilities (ADR-003, ARCHITECTURE.md §4). Session 3 provisioned the database. This session adds Storage buckets and the StorageApi expansion. Email providers are already configured in Appwrite.

## Revision — Email via Functions, not browser MessagingApi

The original design proposed a browser-side `MessagingApi.sendEmail`. Verification against the SDKs showed this is not possible:

- Browser `appwrite@27.0.0`'s `Messaging` service exposes only `createSubscriber` / `deleteSubscriber` — there is no `createEmail`.
- `createEmail` exists only in `node-appwrite` (server-side) and requires an API key.

Sending email is a business operation, and `AGENTS.md` states Appwrite Functions are the security boundary for business operations and API keys must remain server-side. Therefore email sending belongs in an Appwrite Function, invoked through the existing `FunctionsApi.createExecution`. No browser `MessagingApi` is added in this session.

## Non-Goals

- Browser `MessagingApi` / direct client-side email — rejected; use an Appwrite Function
- SMS/Push messaging — deferred to when needed
- UI upload components — this session only creates buckets and API adapters
- File virus scanning / image transformations — use Appwrite defaults
- Messaging topic/subscription management — deferred

## Storage

### Buckets (3)

Appwrite's `allowedFileExtensions` matches on file **extensions**, not MIME types (Appwrite docs: "Limit the file extensions allowed in the bucket… A maximum of 100 file extensions can be added"). Wildcards such as `image/*` are not supported.

`maximumFileSize` is capped by the Appwrite server at **30,000,000 bytes** (verified against the live project: `Value must be a valid range between 1 and 30,000,000`). The `documents` bucket therefore uses `30_000_000` rather than the original 50MB intent.

| Bucket ID | Purpose | Max Size | Allowed Extensions | Intended access |
|---|---|---|---|---|
| `branding-logos` | Org logos (light/dark) + favicon | 5MB | png, jpg, jpeg, svg, webp | org members read, admin write |
| `documents` | General documents (PDFs, sheets) | 30,000,000 B (Appwrite cap) | pdf, txt, csv, doc, docx, xls, xlsx, png, jpg, jpeg, webp | org members read/write |
| `avatars` | User avatars | 2MB | png, jpg, jpeg, webp | any authenticated read, owner write |

Bucket-level default permissions are provisioned **empty** (deny by default) with `fileSecurity: true`. The "intended access" column describes the per-file permissions the upload flow must set when creating a file — it is not statically provisioned, since it depends on the acting organization/team ID.

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
  uploadFile(input: { bucketId: string; fileId: string; file: File; permissions?: string[] }): Promise<AppwriteFile>;
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
2. Frontend calls `storage.uploadFile({ bucketId: "branding-logos", fileId: `${orgId}-light`, file, permissions: ['read("team:<orgId>")'] })`
3. `uploadFile` returns the created `AppwriteFile` (`$id`, `bucketId`, etc.)
4. The display URL is derived from the returned file via `storage.getFileViewUrl({ bucketId: "branding-logos", fileId: file.$id })`
5. That URL is saved to `organization_profiles.logoLight`

Per-file `permissions` must be supplied at upload time because the buckets are provisioned deny-by-default (`permissions: []`, `fileSecurity: true`). Org members get read access through `read("team:<orgId>")`; write access follows the same team-role convention.

## Email (Deferred to Appwrite Functions)

No browser messaging adapter is added. When transactional email is needed, create an Appwrite Function that uses `node-appwrite`'s `Messaging.createEmail` server-side, then call it from application code via the existing `FunctionsApi.createExecution`. This keeps the API key server-side and respects the Functions-as-security-boundary rule.

## Files Created/Modified

| File | Change |
|---|---|
| `packages/api-client/src/dto.ts` | Add `AppwriteFile` |
| `packages/api-client/src/client.ts` | Expand `StorageApi` |
| `packages/api-client/src/adapters/storage.ts` | Add upload, delete, list, download, view methods |
| `packages/provisioning/src/config.ts` | Add `STORAGE_BUCKETS` constant |
| `packages/provisioning/src/buckets.ts` | **New** — create buckets via node-appwrite |
| `packages/api-client/src/adapters/storage.test.ts` | Add ~8 new tests |
| `packages/provisioning/src/__tests__/buckets.test.ts` | **New** — ~5 tests |

## Validation

After implementation:

- `pnpm lint` — 0 errors, 0 warnings
- `pnpm typecheck` — exit 0
- `pnpm test` — all tests pass (existing + new)
- `pnpm build` — exit 0
- `pnpm provision` — creates buckets alongside existing database/tables
