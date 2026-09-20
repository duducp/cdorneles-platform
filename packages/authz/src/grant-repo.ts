/**
 * Data access contract for authorization decisions.
 *
 * Each Appwrite Function provides a concrete implementation backed by
 * node-appwrite. The authorize function depends only on this interface,
 * never on Appwrite directly.
 */
export interface GrantRepo {
  listMemberships(teamId: string): Promise<Array<{ userId: string; roles: string[] }>>;
  listOrganizationRoles(organizationId: string): Promise<Array<{ id: string; name: string }>>;
  listPermissionKeysForRoles(roleIds: readonly string[]): Promise<string[]>;
  listApplicationIdsForRoles(roleIds: readonly string[]): Promise<string[]>;
  getOrganizationProfile(organizationId: string): Promise<{ active: boolean } | null>;
  isFeatureEnabled(organizationId: string, featureKey: string): Promise<boolean>;
}
