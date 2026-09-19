import { Teams } from "appwrite";
import type { Client } from "appwrite";

import type { TeamsApi } from "../client";
import type { AppwriteMembership, AppwriteTeam } from "../dto";
import { mapAppwriteError } from "./map-error";

export function createTeamsApi(client: Client): TeamsApi {
  const teams = new Teams(client);

  return {
    async listTeams(): Promise<AppwriteTeam[]> {
      try {
        const result = await teams.list();
        return result.teams.map((team) => ({ $id: team.$id, name: team.name }));
      } catch (error) {
        throw mapAppwriteError(error);
      }
    },

    async listMemberships(teamId): Promise<AppwriteMembership[]> {
      try {
        const result = await teams.listMemberships({ teamId });
        return result.memberships.map((membership) => ({
          $id: membership.$id,
          teamId: membership.teamId,
          userId: membership.userId,
          roles: membership.roles,
        }));
      } catch (error) {
        throw mapAppwriteError(error);
      }
    },
  };
}
