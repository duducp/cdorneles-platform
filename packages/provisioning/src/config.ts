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
