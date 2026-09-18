import type { FeatureKey } from "./feature-key";
import type { PermissionKey } from "./permission-key";

/**
 * Inputs to the effective-access decision (ADR-005 / ARCHITECTURE §6).
 * Frontend evaluation is UX only; Appwrite Functions remain the security
 * boundary and re-authorize server-side.
 */
export interface AccessContext {
  authenticated: boolean;
  membership: boolean;
  organizationActive: boolean;
  applicationAccess: boolean;
  permission: boolean;
  featureEnabled: boolean;
}

export function resolveEffectiveAccess(context: AccessContext): boolean {
  return (
    context.authenticated &&
    context.membership &&
    context.organizationActive &&
    context.applicationAccess &&
    context.permission &&
    context.featureEnabled
  );
}

/** What a user has been granted for the active organization/application. */
export interface GrantedAccess {
  permissions: readonly PermissionKey[];
  features: readonly FeatureKey[];
}

export function hasPermission(granted: readonly PermissionKey[], required: PermissionKey): boolean {
  return granted.includes(required);
}

export function hasAnyPermission(
  granted: readonly PermissionKey[],
  required: readonly PermissionKey[],
): boolean {
  return required.some((permission) => granted.includes(permission));
}

export function hasAllPermissions(
  granted: readonly PermissionKey[],
  required: readonly PermissionKey[],
): boolean {
  return required.every((permission) => granted.includes(permission));
}

export function hasFeature(granted: readonly FeatureKey[], required: FeatureKey): boolean {
  return granted.includes(required);
}

export interface AccessChecker {
  hasPermission: (required: PermissionKey) => boolean;
  hasAnyPermission: (required: readonly PermissionKey[]) => boolean;
  hasAllPermissions: (required: readonly PermissionKey[]) => boolean;
  hasFeature: (required: FeatureKey) => boolean;
}

/** Deny-by-default checker bound to a set of granted capabilities. */
export function createAccessChecker(granted: GrantedAccess): AccessChecker {
  return {
    hasPermission: (required) => hasPermission(granted.permissions, required),
    hasAnyPermission: (required) => hasAnyPermission(granted.permissions, required),
    hasAllPermissions: (required) => hasAllPermissions(granted.permissions, required),
    hasFeature: (required) => hasFeature(granted.features, required),
  };
}
