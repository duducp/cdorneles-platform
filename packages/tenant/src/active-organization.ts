import { isMemberOf, type Organization, type OrganizationMembership } from "./types";

export interface ResolveActiveOrganizationInput {
  organizations: readonly Organization[];
  /**
   * The **authenticated user's** memberships. The gate below is only as strong
   * as this input: passing unfiltered team memberships would defeat it.
   */
  memberships: readonly OrganizationMembership[];
  /** Organization implied by the trusted hostname (ADR-007). */
  domainOrganizationId?: string | null;
  /** The user's explicit preference. */
  preferredOrganizationId?: string | null;
}

/**
 * Resolves the active organization from trusted context only.
 *
 * An id is honored only when it appears in `organizations` AND the user holds a
 * matching membership. Anything else is ignored, so a client- or
 * domain-supplied id can never grant access on its own (ADR-004).
 */
export function resolveActiveOrganization(
  input: ResolveActiveOrganizationInput,
): Organization | null {
  const { organizations, memberships, domainOrganizationId, preferredOrganizationId } = input;

  const honor = (organizationId: string | null | undefined): Organization | null => {
    if (!organizationId || !isMemberOf(organizationId, memberships)) {
      return null;
    }
    return organizations.find((organization) => organization.id === organizationId) ?? null;
  };

  return (
    honor(domainOrganizationId) ??
    honor(preferredOrganizationId) ??
    organizations.find((organization) => isMemberOf(organization.id, memberships)) ??
    null
  );
}
