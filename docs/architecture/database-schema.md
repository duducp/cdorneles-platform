# Database Schema — Carlos Dorneles Platform

Database: `cdorneles_platform` (Appwrite TablesDB)

## Tables

### organization_profiles

| Column | Type | Required | Notes |
|--------|------|----------|-------|
| organizationId | string(36) | yes | FK → Appwrite Team |
| displayName | string(255) | yes | |
| logoLight | string(2048) | no | URL |
| logoDark | string(2048) | no | URL |
| favicon | string(2048) | no | URL |
| primaryColor | string(7) | no | Hex color |
| secondaryColor | string(7) | no | Hex color |
| defaultTheme | enum(light,dark) | no | |
| active | boolean | yes | Default: true |

**Indexes:** `org_unique` (unique on organizationId)
**Row security:** ON — org members can read their own profile

### roles

| Column | Type | Required | Notes |
|--------|------|----------|-------|
| organizationId | string(36) | yes | FK → Appwrite Team |
| name | string(255) | yes | e.g. "owner", "admin", "member" |
| description | string(1024) | no | |

**Indexes:** `org_idx` (key on organizationId)
**Row security:** ON

### permissions

| Column | Type | Required | Notes |
|--------|------|----------|-------|
| key | string(255) | yes | e.g. "customers.read" |
| description | string(1024) | yes | |

**Indexes:** `key_unique` (unique on key)
**Row security:** OFF — global seed table

### role_permissions

| Column | Type | Required | Notes |
|--------|------|----------|-------|
| roleId | string(36) | yes | FK → roles |
| permissionId | string(36) | yes | FK → permissions |

**Indexes:** `role_idx` (key on roleId), `permission_idx` (key on permissionId)
**Row security:** ON

### applications

| Column | Type | Required | Notes |
|--------|------|----------|-------|
| appId | string(255) | yes | e.g. "admin", "client" |
| name | string(255) | yes | |
| description | string(1024) | yes | |

**Indexes:** `appId_unique` (unique on appId)
**Row security:** OFF — global seed table

### role_applications

| Column | Type | Required | Notes |
|--------|------|----------|-------|
| roleId | string(36) | yes | FK → roles |
| applicationId | string(36) | yes | FK → applications |

**Indexes:** `role_idx` (key on roleId), `application_idx` (key on applicationId)
**Row security:** ON

### features

| Column | Type | Required | Notes |
|--------|------|----------|-------|
| key | string(255) | yes | e.g. "white-label", "customers" |
| name | string(255) | yes | |
| description | string(1024) | no | |

**Indexes:** `key_unique` (unique on key)
**Row security:** OFF — global seed table

### organization_features

| Column | Type | Required | Notes |
|--------|------|----------|-------|
| organizationId | string(36) | yes | FK → Appwrite Team |
| featureId | string(36) | yes | FK → features |
| enabled | boolean | yes | Default: false |

**Indexes:** `org_feature_unique` (unique on organizationId + featureId)
**Row security:** ON

### domains

| Column | Type | Required | Notes |
|--------|------|----------|-------|
| organizationId | string(36) | yes | FK → Appwrite Team |
| hostname | string(255) | yes | |
| applicationId | string(36) | no | FK → applications |

**Indexes:** `org_idx` (key on organizationId), `hostname_unique` (unique on hostname)
**Row security:** ON

### audit_logs

| Column | Type | Required | Notes |
|--------|------|----------|-------|
| userId | string(36) | yes | |
| organizationId | string(36) | no | |
| action | string(255) | yes | e.g. "organizations.update" |
| resourceType | string(255) | yes | |
| resourceId | string(36) | no | |
| metadata | string(65535) | no | JSON string |
| timestamp | datetime | yes | |

**Indexes:** `org_idx` (key on organizationId), `user_idx` (key on userId), `timestamp_idx` (key on timestamp DESC)
**Row security:** ON

## Storage Buckets

| Bucket | Max Size | Extensions |
|--------|----------|------------|
| branding-logos | 5 MB | png, jpg, jpeg, svg, webp |
| documents | 30 MB | pdf, txt, csv, doc, docx, xls, xlsx, png, jpg, jpeg, webp |
| avatars | 2 MB | png, jpg, jpeg, webp |

## Seeded Data

- **2 applications:** admin, client
- **24 permissions:** organizations.{read,update}, customers.{read,create,update,delete}, orders.{read,create,update,delete}, invoices.{read,create,approve}, products.{read,create,update,delete}, roles.{read,create,update,delete}, features.{read,manage}, audit.read
- **8 features:** customers, orders, invoices, products, inventory, financial, sales, white-label

## Per-Organization Rows

Provisioning seeds only the **global** definitions above. The per-organization
rows are created at runtime by the `provision-organization` Appwrite Function,
which is idempotent (create-if-missing):

| Table | Rows created |
|-------|--------------|
| `organization_profiles` | one row (`displayName`, `active: true`) |
| `roles` | `owner`, `admin`, `member` |
| `role_permissions` | owner/admin → all permissions (admin excludes `features.manage`); member → read permissions |
| `role_applications` | owner/admin → admin + client; member → client |
| `organization_features` | one row per feature; only `white-label` enabled by default |

The `role_permissions` and `role_applications` rows reference the deterministic
seeded IDs (`perm_*`, `app_*`, `feat_*`), so no lookup is required.

