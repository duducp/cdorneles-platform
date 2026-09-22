import type { FunctionsApi, TeamsApi } from "@cdorneles/api-client";
import type { Branding } from "@cdorneles/types";

import type { Organization, OrganizationMembership } from "./types";

/** Resolves the authenticated user's organizations from Appwrite Teams (ADR-004). */
export interface TenantService {
  /**
   * Organizations the authenticated user belongs to.
   *
   * Relies on `TeamsApi` being session-scoped (the Appwrite Web SDK's
   * `Teams.list` returns only the caller's teams). A server/API-key-backed
   * implementation would return every team in the project, so `listMemberships`
   * — which filters by `userId` — is the safe source when in doubt.
   */
  listOrganizations(): Promise<Organization[]>;
  listMemberships(userId: string): Promise<OrganizationMembership[]>;
  getProfile(organizationId: string): Promise<Branding | null>;
  /**
   * Creates a new organization (Appwrite Team) and provisions its platform
   * rows. The creator becomes the team owner. Provisioning is idempotent and
   * retriable; a provisioning failure does not fail the creation, since the
   * team itself already exists.
   */
  createOrganization(name: string): Promise<Organization>;
}

export function createAppwriteTenantService(
  teamsApi: TeamsApi,
  functionsApi: FunctionsApi,
): TenantService {
  const platformTeamId = process.env.NEXT_PUBLIC_PLATFORM_TEAM_ID ?? "";

  return {
    async listOrganizations() {
      const teams = await teamsApi.listTeams();
      return teams
        .filter((team) => team.$id !== platformTeamId)
        .map((team) => ({ id: team.$id, name: team.name }));
    },

    async listMemberships(userId: string) {
      const teams = await teamsApi.listTeams();

      const memberships = await Promise.all(
        teams
          .filter((team) => team.$id !== platformTeamId)
          .map(async (team): Promise<OrganizationMembership | null> => {
            const rows = await teamsApi.listMemberships(team.$id);
            const own = rows.find((row) => row.userId === userId);
            return own ? { organizationId: team.$id, roles: own.roles } : null;
          }),
      );

      return memberships.filter(
        (membership): membership is OrganizationMembership => membership !== null,
      );
    },

    async getProfile(organizationId: string): Promise<Branding | null> {
      try {
        const response = await functionsApi.createExecution({
          functionId: "get-organization-profile",
          body: { organizationId },
          method: "POST",
        });

        const data = JSON.parse(response.responseBody);
        if (data.error) return null;

        return {
          displayName: data.displayName ?? "",
          logoLight: data.logoLight ?? null,
          logoDark: data.logoDark ?? null,
          favicon: data.favicon ?? null,
          primaryColor: data.primaryColor ?? null,
          secondaryColor: data.secondaryColor ?? null,
          defaultTheme: data.defaultTheme ?? "light",
        };
      } catch (error) {
        console.warn("getProfile failed for organizationId:", organizationId, error);
        return null;
      }
    },

    async createOrganization(name: string): Promise<Organization> {
      const team = await teamsApi.createTeam({ name });

      try {
        await functionsApi.createExecution({
          functionId: "provision-organization",
          body: { organizationId: team.$id, displayName: name },
          method: "POST",
        });
      } catch (error) {
        console.warn("provision-organization failed for", team.$id, error);
      }

      return { id: team.$id, name: team.name };
    },
  };
}
