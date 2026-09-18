/**
 * Tenancy contracts (ADR-004, docs/tenancy).
 *
 * An Organization IS an Appwrite Team. These types are lightweight projections
 * of Team data, not duplicate stored entities.
 */

export interface Organization {
  /** Appwrite Team id. */
  id: string;
  name: string;
}

/** User-to-organization relationship, projected from Team membership roles. */
export interface OrganizationMembership {
  organizationId: string;
  roles: string[];
}

/**
 * Never trust a client-supplied organization id. It is only trustworthy when
 * the authenticated user actually holds a matching membership.
 */
export function isMemberOf(
  organizationId: string,
  memberships: readonly OrganizationMembership[],
): boolean {
  return memberships.some((membership) => membership.organizationId === organizationId);
}

export function findMembership(
  organizationId: string,
  memberships: readonly OrganizationMembership[],
): OrganizationMembership | null {
  return memberships.find((membership) => membership.organizationId === organizationId) ?? null;
}
