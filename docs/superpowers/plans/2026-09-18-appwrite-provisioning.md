# Appwrite Backend Provisioning — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Create a reproducible provisioning script that creates the Appwrite database, 10 tables with attributes/indexes, and seeds initial data.

**Architecture:** Server-side package (`@cdorneles/provisioning`) using `node-appwrite` SDK with API key auth. CLI reads env vars, calls `runProvisioning()` which orchestrates database creation → table creation → seed insertion.

**Tech Stack:** `node-appwrite`, `tsx`, Vitest, TypeScript, pnpm workspaces.

---

## File Structure

| File | Responsibility |
|---|---|
| `packages/provisioning/package.json` | Package config, deps, scripts |
| `packages/provisioning/tsconfig.json` | TypeScript config |
| `packages/provisioning/src/config.ts` | Table schema definitions (constants) |
| `packages/provisioning/src/database.ts` | Create database, tables, attributes, indexes |
| `packages/provisioning/src/seeds.ts` | Insert applications, permissions, features |
| `packages/provisioning/src/index.ts` | Main export (`runProvisioning`) |
| `packages/provisioning/src/cli.ts` | CLI entrypoint (reads env vars) |
| `packages/provisioning/src/__tests__/database.test.ts` | Database creation tests |
| `packages/provisioning/src/__tests__/seeds.test.ts` | Seed insertion tests |

---

### Task 1: Scaffold package structure

**Files:**
- Create: `packages/provisioning/package.json`
- Create: `packages/provisioning/tsconfig.json`
- Modify: `pnpm-workspace.yaml`

- [ ] **Step 1: Create package directory**

```bash
mkdir -p packages/provisioning/src/__tests__
```

- [ ] **Step 2: Create `packages/provisioning/package.json`**

```json
{
  "name": "@cdorneles/provisioning",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "main": "./src/index.ts",
  "scripts": {
    "typecheck": "tsc --noEmit",
    "test": "vitest run",
    "provision": "tsx src/cli.ts"
  },
  "dependencies": {
    "node-appwrite": "^17.0.0"
  },
  "devDependencies": {
    "tsx": "catalog:",
    "typescript": "catalog:",
    "vitest": "catalog:"
  }
}
```

- [ ] **Step 3: Create `packages/provisioning/tsconfig.json`**

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "outDir": "./dist",
    "rootDir": "./src"
  },
  "include": ["src/**/*.ts"]
}
```

- [ ] **Step 4: Add `node-appwrite` to pnpm catalog**

Edit `pnpm-workspace.yaml` — add under `catalog:`:

```yaml
  node-appwrite: ^17.0.0
```

- [ ] **Step 5: Install dependencies**

```bash
pnpm install
```

- [ ] **Step 6: Commit**

```bash
git add packages/provisioning/ pnpm-workspace.yaml pnpm-lock.yaml
git commit -m "chore: scaffold @cdorneles/provisioning package"
```

---

### Task 2: Define table schemas in config.ts

**Files:**
- Create: `packages/provisioning/src/config.ts`

- [ ] **Step 1: Create `packages/provisioning/src/config.ts`**

```ts
export const DATABASE_ID = "cdorneles_platform";
export const DATABASE_NAME = "Cdorneles Platform";

export interface AttributeDef {
  key: string;
  type: "string" | "integer" | "boolean" | "datetime" | "enum";
  required: boolean;
  size?: number;
  elements?: string[];
  default?: unknown;
}

export interface TableDef {
  id: string;
  name: string;
  attributes: AttributeDef[];
}

export const TABLES: TableDef[] = [
  {
    id: "organization_profiles",
    name: "Organization Profiles",
    attributes: [
      { key: "organizationId", type: "string", required: true, size: 36 },
      { key: "displayName", type: "string", required: true, size: 255 },
      { key: "logoLight", type: "string", required: false, size: 2048 },
      { key: "logoDark", type: "string", required: false, size: 2048 },
      { key: "favicon", type: "string", required: false, size: 2048 },
      { key: "primaryColor", type: "string", required: false, size: 7 },
      { key: "secondaryColor", type: "string", required: false, size: 7 },
      { key: "defaultTheme", type: "enum", required: false, elements: ["light", "dark"] },
    ],
  },
  {
    id: "roles",
    name: "Roles",
    attributes: [
      { key: "organizationId", type: "string", required: true, size: 36 },
      { key: "name", type: "string", required: true, size: 255 },
      { key: "description", type: "string", required: false, size: 1024 },
    ],
  },
  {
    id: "permissions",
    name: "Permissions",
    attributes: [
      { key: "key", type: "string", required: true, size: 255 },
      { key: "description", type: "string", required: true, size: 1024 },
    ],
  },
  {
    id: "role_permissions",
    name: "Role Permissions",
    attributes: [
      { key: "roleId", type: "string", required: true, size: 36 },
      { key: "permissionId", type: "string", required: true, size: 36 },
    ],
  },
  {
    id: "applications",
    name: "Applications",
    attributes: [
      { key: "appId", type: "string", required: true, size: 255 },
      { key: "name", type: "string", required: true, size: 255 },
      { key: "description", type: "string", required: true, size: 1024 },
    ],
  },
  {
    id: "role_applications",
    name: "Role Applications",
    attributes: [
      { key: "roleId", type: "string", required: true, size: 36 },
      { key: "applicationId", type: "string", required: true, size: 36 },
    ],
  },
  {
    id: "features",
    name: "Features",
    attributes: [
      { key: "key", type: "string", required: true, size: 255 },
      { key: "name", type: "string", required: true, size: 255 },
      { key: "description", type: "string", required: false, size: 1024 },
    ],
  },
  {
    id: "organization_features",
    name: "Organization Features",
    attributes: [
      { key: "organizationId", type: "string", required: true, size: 36 },
      { key: "featureId", type: "string", required: true, size: 36 },
      { key: "enabled", type: "boolean", required: true, default: false },
    ],
  },
  {
    id: "domains",
    name: "Domains",
    attributes: [
      { key: "organizationId", type: "string", required: true, size: 36 },
      { key: "hostname", type: "string", required: true, size: 255 },
      { key: "applicationId", type: "string", required: false, size: 36 },
    ],
  },
  {
    id: "audit_logs",
    name: "Audit Logs",
    attributes: [
      { key: "userId", type: "string", required: true, size: 36 },
      { key: "organizationId", type: "string", required: false, size: 36 },
      { key: "action", type: "string", required: true, size: 255 },
      { key: "resourceType", type: "string", required: true, size: 255 },
      { key: "resourceId", type: "string", required: false, size: 36 },
      { key: "metadata", type: "string", required: false, size: 65535 },
      { key: "timestamp", type: "datetime", required: true },
    ],
  },
];

export interface SeedDef {
  id: string;
  data: Record<string, unknown>;
}

export const SEED_APPLICATIONS: SeedDef[] = [
  { id: "app_admin", data: { appId: "admin", name: "Admin Panel", description: "Internal Cdorneles administration" } },
  { id: "app_client", data: { appId: "client", name: "Client Panel", description: "Organization/tenant administration" } },
  { id: "app_customer", data: { appId: "customer", name: "Customer Portal", description: "End-customer experience" } },
];

export const SEED_PERMISSIONS: SeedDef[] = [
  { id: "perm_organizations_read", data: { key: "organizations.read", description: "Read organization data" } },
  { id: "perm_organizations_update", data: { key: "organizations.update", description: "Update organization settings" } },
  { id: "perm_customers_read", data: { key: "customers.read", description: "List and view customers" } },
  { id: "perm_customers_create", data: { key: "customers.create", description: "Create new customers" } },
  { id: "perm_customers_update", data: { key: "customers.update", description: "Update customer data" } },
  { id: "perm_customers_delete", data: { key: "customers.delete", description: "Delete customers" } },
  { id: "perm_orders_read", data: { key: "orders.read", description: "List and view orders" } },
  { id: "perm_orders_create", data: { key: "orders.create", description: "Create new orders" } },
  { id: "perm_orders_update", data: { key: "orders.update", description: "Update order data" } },
  { id: "perm_orders_delete", data: { key: "orders.delete", description: "Delete orders" } },
  { id: "perm_invoices_read", data: { key: "invoices.read", description: "List and view invoices" } },
  { id: "perm_invoices_create", data: { key: "invoices.create", description: "Create new invoices" } },
  { id: "perm_invoices_approve", data: { key: "invoices.approve", description: "Approve invoices" } },
  { id: "perm_products_read", data: { key: "products.read", description: "List and view products" } },
  { id: "perm_products_create", data: { key: "products.create", description: "Create new products" } },
  { id: "perm_products_update", data: { key: "products.update", description: "Update product data" } },
  { id: "perm_products_delete", data: { key: "products.delete", description: "Delete products" } },
  { id: "perm_roles_read", data: { key: "roles.read", description: "List and view roles" } },
  { id: "perm_roles_create", data: { key: "roles.create", description: "Create new roles" } },
  { id: "perm_roles_update", data: { key: "roles.update", description: "Update role data" } },
  { id: "perm_roles_delete", data: { key: "roles.delete", description: "Delete roles" } },
  { id: "perm_features_read", data: { key: "features.read", description: "List and view features" } },
  { id: "perm_features_manage", data: { key: "features.manage", description: "Enable/disable features for organizations" } },
  { id: "perm_audit_read", data: { key: "audit.read", description: "View audit logs" } },
];

export const SEED_FEATURES: SeedDef[] = [
  { id: "feat_customers", data: { key: "customers", name: "Customers module" } },
  { id: "feat_orders", data: { key: "orders", name: "Orders module" } },
  { id: "feat_invoices", data: { key: "invoices", name: "Invoices module" } },
  { id: "feat_products", data: { key: "products", name: "Products module" } },
  { id: "feat_inventory", data: { key: "inventory", name: "Inventory module" } },
  { id: "feat_financial", data: { key: "financial", name: "Financial module" } },
  { id: "feat_sales", data: { key: "sales", name: "Sales module" } },
];
```

- [ ] **Step 2: Commit**

```bash
git add packages/provisioning/src/config.ts
git commit -m "feat(provisioning): add table schema definitions and seed constants"
```

---

### Task 3: Implement database creation logic

**Files:**
- Create: `packages/provisioning/src/database.ts`

- [ ] **Step 1: Create `packages/provisioning/src/database.ts`**

```ts
import { Client, Databases } from "node-appwrite";
import { DATABASE_ID, DATABASE_NAME, TABLES, type TableDef } from "./config.js";

export interface DatabaseConfig {
  endpoint: string;
  projectId: string;
  apiKey: string;
}

function createDatabasesApi(config: DatabaseConfig): Databases {
  const client = new Client()
    .setEndpoint(config.endpoint)
    .setProject(config.projectId)
    .setKey(config.apiKey);
  return new Databases(client);
}

async function createAttribute(
  databases: Databases,
  tableId: string,
  attr: TableDef["attributes"][number],
): Promise<void> {
  const common = { databaseId: DATABASE_ID, collectionId: tableId, key: attr.key, required: attr.required };

  switch (attr.type) {
    case "string":
      await databases.createStringAttribute({ ...common, size: attr.size ?? 255 });
      break;
    case "integer":
      await databases.createIntegerAttribute(common);
      break;
    case "boolean":
      await databases.createBooleanAttribute(common);
      break;
    case "datetime":
      await databases.createDatetimeAttribute(common);
      break;
    case "enum":
      await databases.createEnumAttribute({ ...common, elements: attr.elements ?? [] });
      break;
  }
}

export async function createDatabase(config: DatabaseConfig): Promise<void> {
  const databases = createDatabasesApi(config);

  console.log("[provisioning] Creating database...");

  try {
    await databases.create({ databaseId: DATABASE_ID, name: DATABASE_NAME });
    console.log("[provisioning] Database created.");
  } catch (error: unknown) {
    const code = (error as { code?: number }).code;
    if (code === 409) {
      console.log("[provisioning] Database already exists, skipping.");
    } else {
      throw error;
    }
  }

  for (const table of TABLES) {
    console.log(`[provisioning] Creating table: ${table.id}`);

    try {
      await databases.createCollection({
        databaseId: DATABASE_ID,
        collectionId: table.id,
        name: table.name,
      });
      console.log(`[provisioning] Table ${table.id} created.`);
    } catch (error: unknown) {
      const code = (error as { code?: number }).code;
      if (code === 409) {
        console.log(`[provisioning] Table ${table.id} already exists, skipping.`);
      } else {
        throw error;
      }
    }

    for (const attr of table.attributes) {
      try {
        await createAttribute(databases, table.id, attr);
        console.log(`[provisioning]   + ${attr.key} (${attr.type})`);
      } catch (error: unknown) {
        const code = (error as { code?: number }).code;
        if (code === 409) {
          // Attribute already exists, skip
        } else {
          throw error;
        }
      }
    }
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add packages/provisioning/src/database.ts
git commit -m "feat(provisioning): implement database and table creation"
```

---

### Task 4: Implement seed insertion logic

**Files:**
- Create: `packages/provisioning/src/seeds.ts`

- [ ] **Step 1: Create `packages/provisioning/src/seeds.ts`**

```ts
import { Client, Databases } from "node-appwrite";
import {
  DATABASE_ID,
  SEED_APPLICATIONS,
  SEED_PERMISSIONS,
  SEED_FEATURES,
  type SeedDef,
} from "./config.js";

interface SeedConfig {
  endpoint: string;
  projectId: string;
  apiKey: string;
}

function createDatabasesApi(config: SeedConfig): Databases {
  const client = new Client()
    .setEndpoint(config.endpoint)
    .setProject(config.projectId)
    .setKey(config.apiKey);
  return new Databases(client);
}

async function seedTable(
  databases: Databases,
  collectionId: string,
  seeds: SeedDef[],
): Promise<void> {
  for (const seed of seeds) {
    try {
      await databases.createDocument({
        databaseId: DATABASE_ID,
        collectionId,
        documentId: seed.id,
        data: seed.data,
      });
      console.log(`[provisioning]   Seeded ${collectionId}/${seed.id}`);
    } catch (error: unknown) {
      const code = (error as { code?: number }).code;
      if (code === 409) {
        // Document already exists, skip
      } else {
        throw error;
      }
    }
  }
}

export async function seedData(config: SeedConfig): Promise<void> {
  const databases = createDatabasesApi(config);

  console.log("[provisioning] Seeding applications...");
  await seedTable(databases, "applications", SEED_APPLICATIONS);

  console.log("[provisioning] Seeding permissions...");
  await seedTable(databases, "permissions", SEED_PERMISSIONS);

  console.log("[provisioning] Seeding features...");
  await seedTable(databases, "features", SEED_FEATURES);

  console.log("[provisioning] Seeds complete.");
}
```

- [ ] **Step 2: Commit**

```bash
git add packages/provisioning/src/seeds.ts
git commit -m "feat(provisioning): implement seed data insertion"
```

---

### Task 5: Create main export and CLI

**Files:**
- Create: `packages/provisioning/src/index.ts`
- Create: `packages/provisioning/src/cli.ts`

- [ ] **Step 1: Create `packages/provisioning/src/index.ts`**

```ts
export { createDatabase } from "./database.js";
export { seedData } from "./seeds.js";
export { DATABASE_ID, DATABASE_NAME, TABLES, SEED_APPLICATIONS, SEED_PERMISSIONS, SEED_FEATURES } from "./config.js";
export type { DatabaseConfig } from "./database.js";
export type { TableDef, AttributeDef, SeedDef } from "./config.js";

import { createDatabase, type DatabaseConfig } from "./database.js";
import { seedData } from "./seeds.js";

export interface ProvisioningConfig extends DatabaseConfig {}

export async function runProvisioning(config: ProvisioningConfig): Promise<void> {
  console.log("[provisioning] Starting provisioning...");

  await createDatabase(config);
  await seedData(config);

  console.log("[provisioning] Provisioning complete.");
}
```

- [ ] **Step 2: Create `packages/provisioning/src/cli.ts`**

```ts
import { runProvisioning } from "./index.js";

const endpoint = process.env.APPWRITE_ENDPOINT;
const projectId = process.env.APPWRITE_PROJECT_ID;
const apiKey = process.env.APPWRITE_API_KEY;

if (!endpoint || !projectId || !apiKey) {
  console.error("[provisioning] Missing required env vars: APPWRITE_ENDPOINT, APPWRITE_PROJECT_ID, APPWRITE_API_KEY");
  process.exit(1);
}

try {
  await runProvisioning({ endpoint, projectId, apiKey });
} catch (error) {
  console.error("[provisioning] Fatal error:", error);
  process.exit(1);
}
```

- [ ] **Step 3: Commit**

```bash
git add packages/provisioning/src/index.ts packages/provisioning/src/cli.ts
git commit -m "feat(provisioning): add main export and CLI entrypoint"
```

---

### Task 6: Write tests

**Files:**
- Create: `packages/provisioning/src/__tests__/database.test.ts`
- Create: `packages/provisioning/src/__tests__/seeds.test.ts`

- [ ] **Step 1: Create `packages/provisioning/src/__tests__/database.test.ts`**

```ts
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("node-appwrite", () => {
  const mockCreate = vi.fn().mockResolvedValue({ $id: "test" });
  const mockList = vi.fn().mockResolvedValue({ databases: [] });
  const mockCreateCollection = vi.fn().mockResolvedValue({ $id: "test" });
  const mockCreateStringAttribute = vi.fn().mockResolvedValue({});

  return {
    Client: vi.fn().mockImplementation(() => ({
      setEndpoint: vi.fn().mockReturnThis(),
      setProject: vi.fn().mockReturnThis(),
      setKey: vi.fn().mockReturnThis(),
    })),
    Databases: vi.fn().mockImplementation(() => ({
      create: mockCreate,
      list: mockList,
      createCollection: mockCreateCollection,
      createStringAttribute: mockCreateStringAttribute,
      createIntegerAttribute: vi.fn().mockResolvedValue({}),
      createBooleanAttribute: vi.fn().mockResolvedValue({}),
      createDatetimeAttribute: vi.fn().mockResolvedValue({}),
      createEnumAttribute: vi.fn().mockResolvedValue({}),
    })),
  };
});

import { createDatabase } from "../database.js";

describe("createDatabase", () => {
  const config = {
    endpoint: "https://test.appwrite.io/v1",
    projectId: "test-project",
    apiKey: "test-api-key",
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("is a function", () => {
    expect(typeof createDatabase).toBe("function");
  });

  it("creates database with correct ID and name", async () => {
    const { Databases } = await import("node-appwrite");
    const mockInstance = new (Databases as unknown as new () => { create: ReturnType<typeof vi.fn> })();

    await createDatabase(config);

    expect(mockInstance.create).toHaveBeenCalledWith({
      databaseId: "cdorneles_platform",
      name: "Cdorneles Platform",
    });
  });

  it("creates all 10 tables", async () => {
    const { Databases } = await import("node-appwrite");
    const mockInstance = new (Databases as unknown as new () => { createCollection: ReturnType<typeof vi.fn> })();

    await createDatabase(config);

    expect(mockInstance.createCollection).toHaveBeenCalledTimes(10);
  });

  it("handles 409 conflict (database already exists)", async () => {
    const { Databases } = await import("node-appwrite");
    const mockInstance = new (Databases as unknown as new () => { create: ReturnType<typeof vi.fn> })();
    mockInstance.create.mockRejectedValue({ code: 409 });

    await expect(createDatabase(config)).resolves.not.toThrow();
  });

  it("propagates non-409 errors", async () => {
    const { Databases } = await import("node-appwrite");
    const mockInstance = new (Databases as unknown as new () => { create: ReturnType<typeof vi.fn> })();
    mockInstance.create.mockRejectedValue({ code: 500, message: "Server error" });

    await expect(createDatabase(config)).rejects.toThrow();
  });
});
```

- [ ] **Step 2: Create `packages/provisioning/src/__tests__/seeds.test.ts`**

```ts
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("node-appwrite", () => {
  const mockCreateDocument = vi.fn().mockResolvedValue({ $id: "test" });

  return {
    Client: vi.fn().mockImplementation(() => ({
      setEndpoint: vi.fn().mockReturnThis(),
      setProject: vi.fn().mockReturnThis(),
      setKey: vi.fn().mockReturnThis(),
    })),
    Databases: vi.fn().mockImplementation(() => ({
      createDocument: mockCreateDocument,
    })),
  };
});

import { seedData } from "../seeds.js";

describe("seedData", () => {
  const config = {
    endpoint: "https://test.appwrite.io/v1",
    projectId: "test-project",
    apiKey: "test-api-key",
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("is a function", () => {
    expect(typeof seedData).toBe("function");
  });

  it("inserts 3 applications", async () => {
    const { Databases } = await import("node-appwrite");
    const mockInstance = new (Databases as unknown as new () => { createDocument: ReturnType<typeof vi.fn> })();

    await seedData(config);

    const appCalls = mockInstance.createDocument.mock.calls.filter(
      (call: [{ collectionId: string }]) => call[0].collectionId === "applications",
    );
    expect(appCalls).toHaveLength(3);
  });

  it("inserts 24 permissions", async () => {
    const { Databases } = await import("node-appwrite");
    const mockInstance = new (Databases as unknown as new () => { createDocument: ReturnType<typeof vi.fn> })();

    await seedData(config);

    const permCalls = mockInstance.createDocument.mock.calls.filter(
      (call: [{ collectionId: string }]) => call[0].collectionId === "permissions",
    );
    expect(permCalls).toHaveLength(24);
  });

  it("inserts 7 features", async () => {
    const { Databases } = await import("node-appwrite");
    const mockInstance = new (Databases as unknown as new () => { createDocument: ReturnType<typeof vi.fn> })();

    await seedData(config);

    const featCalls = mockInstance.createDocument.mock.calls.filter(
      (call: [{ collectionId: string }]) => call[0].collectionId === "features",
    );
    expect(featCalls).toHaveLength(7);
  });

  it("handles 409 conflict (document already exists)", async () => {
    const { Databases } = await import("node-appwrite");
    const mockInstance = new (Databases as unknown as new () => { createDocument: ReturnType<typeof vi.fn> })();
    mockInstance.createDocument.mockRejectedValue({ code: 409 });

    await expect(seedData(config)).resolves.not.toThrow();
  });

  it("propagates non-409 errors", async () => {
    const { Databases } = await import("node-appwrite");
    const mockInstance = new (Databases as unknown as new () => { createDocument: ReturnType<typeof vi.fn> })();
    mockInstance.createDocument.mockRejectedValue({ code: 500, message: "Server error" });

    await expect(seedData(config)).rejects.toThrow();
  });
});
```

- [ ] **Step 3: Run tests**

```bash
cd packages/provisioning && pnpm test
```

Expected: all tests pass.

- [ ] **Step 4: Commit**

```bash
git add packages/provisioning/src/__tests__/
git commit -m "test(provisioning): add database and seed tests"
```

---

### Task 7: Add provision script to root

**Files:**
- Modify: `package.json` (root)

- [ ] **Step 1: Add `provision` script to root `package.json`**

Add to `"scripts"`:

```json
"provision": "pnpm --filter @cdorneles/provisioning provision"
```

- [ ] **Step 2: Commit**

```bash
git add package.json
git commit -m "chore: add provision script to root package.json"
```

---

### Task 8: Run verification gates

**Files:** none (verification only)

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

Expected: all tests pass (existing + new provisioning tests).

- [ ] **Step 4: Build**

```bash
pnpm build
```

Expected: exit 0.

- [ ] **Step 5: Final commit (if any fixes needed)**

```bash
git add -A
git commit -m "fix(provisioning): address review feedback"
```

---

## Summary

| Task | Description | Status |
|---|---|---|
| 1 | Scaffold package structure | TODO |
| 2 | Define table schemas in config.ts | TODO |
| 3 | Implement database creation logic | TODO |
| 4 | Implement seed insertion logic | TODO |
| 5 | Create main export and CLI | TODO |
| 6 | Write tests | TODO |
| 7 | Add provision script to root | TODO |
| 8 | Run verification gates | TODO |
