# Appwrite Backend Provisioning — Design Spec

**Date:** 2026-09-18
**Status:** Approved
**Scope:** Session 3 — provision Appwrite database, tables, and seed data

## Context

The Cdorneles Platform has 10 application-specific tables documented in ARCHITECTURE.md §7, but zero provisioning code. The Appwrite backend project is empty (0 databases, 0 tables, 0 teams, 0 functions). Session 1 delivered the SDK adapter, Session 2 wired auth. This session creates the database schema and seed data so the platform has data to work with.

## Goal

Create a reproducible provisioning script (`@cdorneles/provisioning`) that:
1. Creates the `cdorneles_platform` database
2. Creates 10 tables with attributes and indexes
3. Seeds initial data (applications, permissions, features)

## Non-Goals

- Appwrite Teams/Functions/Storage provisioning — deferred to when needed
- Migration system — this is initial provisioning, not schema evolution
- UI for provisioning — CLI/script only

## Database Schema

### Database

```text
ID: cdorneles_platform
Name: Cdorneles Platform
```

### Tables and Attributes

#### 1. organization_profiles

White-label branding per organization.

| Attribute | Type | Required | Notes |
|---|---|---|---|
| `organizationId` | string | yes | Appwrite Team ID |
| `displayName` | string | yes | Org display name |
| `logoLight` | string | no | URL, light mode logo |
| `logoDark` | string | no | URL, dark mode logo |
| `favicon` | string | no | URL |
| `primaryColor` | string | no | Hex color |
| `secondaryColor` | string | no | Hex color |
| `defaultTheme` | enum | no | "light" \| "dark" |

#### 2. roles

Organization-scoped role metadata.

| Attribute | Type | Required | Notes |
|---|---|---|---|
| `organizationId` | string | yes | Appwrite Team ID |
| `name` | string | yes | Role name |
| `description` | string | no | |

#### 3. permissions

Global registry of stable `resource.action` permission keys.

| Attribute | Type | Required | Notes |
|---|---|---|---|
| `key` | string | yes | Unique, ex: "customers.read" |
| `description` | string | yes | |

#### 4. role_permissions

Many-to-many: role → permissions.

| Attribute | Type | Required | Notes |
|---|---|---|---|
| `roleId` | string | yes | |
| `permissionId` | string | yes | |

#### 5. applications

Global application registry.

| Attribute | Type | Required | Notes |
|---|---|---|---|
| `appId` | string | yes | Unique: "admin", "client", "customer" |
| `name` | string | yes | |
| `description` | string | yes | |

#### 6. role_applications

Many-to-many: role → applications.

| Attribute | Type | Required | Notes |
|---|---|---|---|
| `roleId` | string | yes | |
| `applicationId` | string | yes | |

#### 7. features

Globally-defined capabilities.

| Attribute | Type | Required | Notes |
|---|---|---|---|
| `key` | string | yes | Unique, ex: "customers" |
| `name` | string | yes | |
| `description` | string | no | |

#### 8. organization_features

Per-org feature enablement.

| Attribute | Type | Required | Notes |
|---|---|---|---|
| `organizationId` | string | yes | Appwrite Team ID |
| `featureId` | string | yes | |
| `enabled` | boolean | yes | Default: false |

#### 9. domains

Custom domains per organization.

| Attribute | Type | Required | Notes |
|---|---|---|---|
| `organizationId` | string | yes | Appwrite Team ID |
| `hostname` | string | yes | Unique |
| `applicationId` | string | no | Standard app routing |

#### 10. audit_logs

Security-sensitive audit trail.

| Attribute | Type | Required | Notes |
|---|---|---|---|
| `userId` | string | yes | |
| `organizationId` | string | no | |
| `action` | string | yes | Ex: "user.login" |
| `resourceType` | string | yes | Ex: "customer" |
| `resourceId` | string | no | |
| `metadata` | string | no | JSON string |
| `timestamp` | datetime | yes | |

## Seeds

### Applications (3)

```ts
{ $id: "app_admin", appId: "admin", name: "Admin Panel", description: "Internal Cdorneles administration" }
{ $id: "app_client", appId: "client", name: "Client Panel", description: "Organization/tenant administration" }
{ $id: "app_customer", appId: "customer", name: "Customer Portal", description: "End-customer experience" }
```

### Permissions

```ts
// Organizations
{ $id: "perm_organizations_read", key: "organizations.read", description: "Read organization data" }
{ $id: "perm_organizations_update", key: "organizations.update", description: "Update organization settings" }

// Customers
{ $id: "perm_customers_read", key: "customers.read", description: "List and view customers" }
{ $id: "perm_customers_create", key: "customers.create", description: "Create new customers" }
{ $id: "perm_customers_update", key: "customers.update", description: "Update customer data" }
{ $id: "perm_customers_delete", key: "customers.delete", description: "Delete customers" }

// Orders
{ $id: "perm_orders_read", key: "orders.read", description: "List and view orders" }
{ $id: "perm_orders_create", key: "orders.create", description: "Create new orders" }
{ $id: "perm_orders_update", key: "orders.update", description: "Update order data" }
{ $id: "perm_orders_delete", key: "orders.delete", description: "Delete orders" }

// Invoices
{ $id: "perm_invoices_read", key: "invoices.read", description: "List and view invoices" }
{ $id: "perm_invoices_create", key: "invoices.create", description: "Create new invoices" }
{ $id: "perm_invoices_approve", key: "invoices.approve", description: "Approve invoices" }

// Products
{ $id: "perm_products_read", key: "products.read", description: "List and view products" }
{ $id: "perm_products_create", key: "products.create", description: "Create new products" }
{ $id: "perm_products_update", key: "products.update", description: "Update product data" }
{ $id: "perm_products_delete", key: "products.delete", description: "Delete products" }

// Roles
{ $id: "perm_roles_read", key: "roles.read", description: "List and view roles" }
{ $id: "perm_roles_create", key: "roles.create", description: "Create new roles" }
{ $id: "perm_roles_update", key: "roles.update", description: "Update role data" }
{ $id: "perm_roles_delete", key: "roles.delete", description: "Delete roles" }

// Features
{ $id: "perm_features_read", key: "features.read", description: "List and view features" }
{ $id: "perm_features_manage", key: "features.manage", description: "Enable/disable features for organizations" }

// Audit
{ $id: "perm_audit_read", key: "audit.read", description: "View audit logs" }
```

### Features

```ts
{ $id: "feat_customers", key: "customers", name: "Customers module" }
{ $id: "feat_orders", key: "orders", name: "Orders module" }
{ $id: "feat_invoices", key: "invoices", name: "Invoices module" }
{ $id: "feat_products", key: "products", name: "Products module" }
{ $id: "feat_inventory", key: "inventory", name: "Inventory module" }
{ $id: "feat_financial", key: "financial", name: "Financial module" }
{ $id: "feat_sales", key: "sales", name: "Sales module" }
```

## Package Structure

```text
packages/provisioning/
├── package.json           # name: @cdorneles/provisioning
├── tsconfig.json
├── src/
│   ├── index.ts           # export runProvisioning(config, apiKey)
│   ├── database.ts        # creates database + tables + attributes + indexes
│   ├── seeds.ts           # inserts applications, permissions, features
│   ├── config.ts          # table/attribute schema definitions
│   └── cli.ts             # reads env vars, calls runProvisioning
└── README.md
```

### Interface

```ts
export interface ProvisioningConfig {
  endpoint: string;
  projectId: string;
  apiKey: string;
}

export async function runProvisioning(config: ProvisioningConfig): Promise<void>;
```

### CLI

```bash
# Env vars: APPWRITE_ENDPOINT, APPWRITE_PROJECT_ID, APPWRITE_API_KEY
pnpm provision
```

### Dependencies

- `node-appwrite` — Appwrite Node SDK (server-side, API key auth)
- `tsx` — for running the CLI script

### Idempotency

- Database: check `databases.list()` before create
- Tables: check `databases.listCollections()` before create
- Seeds: use pre-defined `$id` values — `createDocument` with specific ID is idempotent in Appwrite

## Error Handling

- **409 (Conflict)** → skip silently (already exists), log with `[provisioning]` prefix
- **Other errors** → propagate with descriptive message
- **Partial failure** → what was created stays, re-run completes the rest
- **Logging** → `console.log("[provisioning]")` prefix for each operation

## Testing

File: `packages/provisioning/src/__tests__/`

Mock the Appwrite SDK (`TablesDB` class) with `vi.fn()`.

### Test cases

1. `runProvisioning` is a function
2. `createDatabase` is called with correct ID and name
3. Each of the 10 tables is created with correct attributes
4. Seeds insert correct number of documents (3 applications, 24 permissions, 7 features)
5. Idempotency: second run skips existing (409 → no error)
6. Error propagation: non-409 errors throw
7. Config validation: missing endpoint/projectId/apiKey throws

~15-20 tests total.

## Files Created/Modified

| File | Change |
|---|---|
| `packages/provisioning/` | **New** — entire package |
| `packages/provisioning/package.json` | Package config |
| `packages/provisioning/tsconfig.json` | TypeScript config |
| `packages/provisioning/src/index.ts` | Main export |
| `packages/provisioning/src/database.ts` | Database + table creation |
| `packages/provisioning/src/seeds.ts` | Seed data insertion |
| `packages/provisioning/src/config.ts` | Schema definitions |
| `packages/provisioning/src/cli.ts` | CLI entrypoint |
| `packages/provisioning/src/__tests__/database.test.ts` | Tests |
| `packages/provisioning/src/__tests__/seeds.test.ts` | Tests |
| `pnpm-workspace.yaml` | Add `node-appwrite` to catalog |
| `package.json` (root) | Add `provision` script |

## Validation

After implementation:

- `pnpm lint` — 0 errors, 0 warnings
- `pnpm typecheck` — exit 0
- `pnpm test` — all tests pass
- `pnpm provision` — creates database, tables, and seeds (against real Appwrite)
- Second `pnpm provision` — idempotent, no errors
