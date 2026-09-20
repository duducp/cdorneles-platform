import type { GrantRepo } from "./grant-repo";

export interface AuthorizeInput {
  userId: string;
  organizationId: string;
  applicationId: string;
  /** Server-side constant (e.g. `organizations.update`), never client input. */
  requiredPermission: string;
  /** Server-side constant (e.g. `white-label`), never client input. */
  requiredFeature: string;
}

export type AuthorizeResult =
  | { ok: true; roles: string[] }
  | { ok: false; status: 401 | 403; reason: string };

/**
 * Effective access (ADR-005): authenticated AND membership AND organization
 * active AND application access AND permission AND feature enabled.
 * Deny-by-default; the first failing condition short-circuits.
 */
export async function authorize(input: AuthorizeInput, repo: GrantRepo): Promise<AuthorizeResult> {
  if (!input.userId) {
    return { ok: false, status: 401, reason: "not authenticated" };
  }

  const memberships = await repo.listMemberships(input.organizationId);
  const membership = memberships.find((member) => member.userId === input.userId);
  if (!membership) {
    return { ok: false, status: 403, reason: "not a member of the organization" };
  }

  const profile = await repo.getOrganizationProfile(input.organizationId);
  if (!profile || profile.active !== true) {
    return { ok: false, status: 403, reason: "organization is not active" };
  }

  const roleRows = await repo.listOrganizationRoles(input.organizationId);
  const roleIds = roleRows
    .filter((role) => membership.roles.includes(role.name))
    .map((role) => role.id);
  if (roleIds.length === 0) {
    return { ok: false, status: 403, reason: "no role grants access" };
  }

  const applicationIds = await repo.listApplicationIdsForRoles(roleIds);
  if (!applicationIds.includes(input.applicationId)) {
    return { ok: false, status: 403, reason: `missing application access: ${input.applicationId}` };
  }

  const permissionKeys = await repo.listPermissionKeysForRoles(roleIds);
  if (!permissionKeys.includes(input.requiredPermission)) {
    return { ok: false, status: 403, reason: `missing permission: ${input.requiredPermission}` };
  }

  const featureEnabled = await repo.isFeatureEnabled(input.organizationId, input.requiredFeature);
  if (!featureEnabled) {
    return { ok: false, status: 403, reason: `missing feature: ${input.requiredFeature}` };
  }

  return { ok: true, roles: membership.roles };
}
