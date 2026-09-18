/**
 * Business permissions use stable `resource.action` keys (ADR-005), for
 * example `customers.read` or `invoices.approve`.
 *
 * The type constrains the shape; `isPermissionKey` enforces the naming rule.
 * Module-specific permission constants are intentionally not defined here yet.
 */
export type PermissionKey = `${string}.${string}`;

const PERMISSION_PATTERN = /^[a-z][a-z0-9_]*\.[a-z][a-z0-9_]*$/;

export function isPermissionKey(value: unknown): value is PermissionKey {
  return typeof value === "string" && PERMISSION_PATTERN.test(value);
}

export function parsePermissionKey(value: string): PermissionKey | null {
  return isPermissionKey(value) ? value : null;
}

export function permissionKey(value: string): PermissionKey {
  if (!isPermissionKey(value)) {
    throw new Error(`Invalid permission key: "${value}" (expected resource.action)`);
  }
  return value;
}
