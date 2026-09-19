import type { TeamsApi } from "@cdorneles/api-client";

import type { Organization, OrganizationMembership } from "./types";

/** Resolves the authenticated user's organizations from Appwrite Teams (ADR-004). */
export interface TenantService {
  listOrganizations(): Promise<Organization[]>;
  listMemberships(userId: string): Promise<OrganizationMembership[]>;
}

export function createAppwriteTenantService(teamsApi: TeamsApi): TenantService {
  return {
    async listOrganizations() {
      const teams = await teamsApi.listTeams();
      return teams.map((team) => ({ id: team.$id, name: team.name }));
    },

    async listMemberships(userId: string) {
      const teams = await teamsApi.listTeams();

      const memberships = await Promise.all(
        teams.map(async (team): Promise<OrganizationMembership | null> => {
          const rows = await teamsApi.listMemberships(team.$id);
          const own = rows.find((row) => row.userId === userId);
          return own ? { organizationId: team.$id, roles: own.roles } : null;
        }),
      );

      return memberships.filter(
        (membership): membership is OrganizationMembership => membership !== null,
      );
    },
  };
}
