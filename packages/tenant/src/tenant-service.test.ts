import { describe, expect, it, vi } from "vitest";

import type { FunctionsApi, TeamsApi } from "@cdorneles/api-client";
import { createAppwriteTenantService } from "./tenant-service";

function createMockTeamsApi(): TeamsApi {
  return {
    listTeams: vi.fn(),
    listMemberships: vi.fn(),
    createTeam: vi.fn(),
  };
}

function createMockFunctionsApi(): FunctionsApi {
  return {
    createExecution: vi.fn(),
    createUser: vi.fn(),
    updateUserPermissions: vi.fn(),
    listUsers: vi.fn(),
    listOrganizations: vi.fn(),
    oneTapLogin: vi.fn(),
    publicLogin: vi.fn(),
    publicMfaChallenge: vi.fn(),
    publicMfaVerify: vi.fn(),
    publicRequestRecovery: vi.fn(),
    publicCompleteRecovery: vi.fn(),
  };
}

describe("createAppwriteTenantService", () => {
  it("is a function", () => {
    expect(typeof createAppwriteTenantService).toBe("function");
  });

  describe("listOrganizations", () => {
    it("maps teams to organizations", async () => {
      const api = createMockTeamsApi();
      vi.mocked(api.listTeams).mockResolvedValue([
        { $id: "org-1", name: "Acme" },
        { $id: "org-2", name: "Globex" },
      ]);

      const service = createAppwriteTenantService(api, createMockFunctionsApi());

      await expect(service.listOrganizations()).resolves.toEqual([
        { id: "org-1", name: "Acme" },
        { id: "org-2", name: "Globex" },
      ]);
    });

    it("omits the configured platform team", async () => {
      vi.stubEnv("NEXT_PUBLIC_PLATFORM_TEAM_ID", "team-platform");
      const api = createMockTeamsApi();
      vi.mocked(api.listTeams).mockResolvedValue([
        { $id: "team-platform", name: "Platform" },
        { $id: "org-1", name: "Acme" },
      ]);

      const service = createAppwriteTenantService(api, createMockFunctionsApi());

      await expect(service.listOrganizations()).resolves.toEqual([{ id: "org-1", name: "Acme" }]);
      vi.unstubAllEnvs();
    });

    it("returns an empty list when the user has no teams", async () => {
      const api = createMockTeamsApi();
      vi.mocked(api.listTeams).mockResolvedValue([]);

      const service = createAppwriteTenantService(api, createMockFunctionsApi());

      await expect(service.listOrganizations()).resolves.toEqual([]);
    });

    it("propagates lookup failures", async () => {
      const api = createMockTeamsApi();
      vi.mocked(api.listTeams).mockRejectedValue(new Error("user_unauthorized"));

      const service = createAppwriteTenantService(api, createMockFunctionsApi());

      await expect(service.listOrganizations()).rejects.toThrow("user_unauthorized");
    });
  });

  describe("listMemberships", () => {
    it("returns roles for each team the user belongs to", async () => {
      const api = createMockTeamsApi();
      vi.mocked(api.listTeams).mockResolvedValue([
        { $id: "org-1", name: "Acme" },
        { $id: "org-2", name: "Globex" },
      ]);
      vi.mocked(api.listMemberships).mockImplementation(async (teamId: string) =>
        teamId === "org-1"
          ? [{ $id: "m1", teamId: "org-1", userId: "u1", roles: ["owner"] }]
          : [{ $id: "m2", teamId: "org-2", userId: "u2", roles: ["admin"] }],
      );

      const service = createAppwriteTenantService(api, createMockFunctionsApi());

      await expect(service.listMemberships("u1")).resolves.toEqual([
        { organizationId: "org-1", roles: ["owner"] },
      ]);
    });

    it("omits the configured platform team", async () => {
      vi.stubEnv("NEXT_PUBLIC_PLATFORM_TEAM_ID", "team-platform");
      const api = createMockTeamsApi();
      vi.mocked(api.listTeams).mockResolvedValue([
        { $id: "team-platform", name: "Platform" },
        { $id: "org-1", name: "Acme" },
      ]);
      vi.mocked(api.listMemberships).mockImplementation(async (teamId: string) =>
        teamId === "team-platform"
          ? [{ $id: "m1", teamId: "team-platform", userId: "u1", roles: ["owner"] }]
          : [{ $id: "m2", teamId: "org-1", userId: "u1", roles: ["admin"] }],
      );

      const service = createAppwriteTenantService(api, createMockFunctionsApi());

      await expect(service.listMemberships("u1")).resolves.toEqual([
        { organizationId: "org-1", roles: ["admin"] },
      ]);
      vi.unstubAllEnvs();
    });

    it("queries memberships for every team", async () => {
      const api = createMockTeamsApi();
      vi.mocked(api.listTeams).mockResolvedValue([
        { $id: "org-1", name: "Acme" },
        { $id: "org-2", name: "Globex" },
      ]);
      vi.mocked(api.listMemberships).mockResolvedValue([]);

      const service = createAppwriteTenantService(api, createMockFunctionsApi());
      await service.listMemberships("u1");

      expect(api.listMemberships).toHaveBeenCalledWith("org-1");
      expect(api.listMemberships).toHaveBeenCalledWith("org-2");
      expect(api.listMemberships).toHaveBeenCalledTimes(2);
    });

    it("omits teams where the user holds no membership", async () => {
      const api = createMockTeamsApi();
      vi.mocked(api.listTeams).mockResolvedValue([{ $id: "org-1", name: "Acme" }]);
      vi.mocked(api.listMemberships).mockResolvedValue([
        { $id: "m9", teamId: "org-1", userId: "someone-else", roles: ["owner"] },
      ]);

      const service = createAppwriteTenantService(api, createMockFunctionsApi());

      await expect(service.listMemberships("u1")).resolves.toEqual([]);
    });

    it("propagates lookup failures", async () => {
      const api = createMockTeamsApi();
      vi.mocked(api.listTeams).mockResolvedValue([{ $id: "org-1", name: "Acme" }]);
      vi.mocked(api.listMemberships).mockRejectedValue(new Error("general_unauthorized"));

      const service = createAppwriteTenantService(api, createMockFunctionsApi());

      await expect(service.listMemberships("u1")).rejects.toThrow("general_unauthorized");
    });
  });

  describe("createOrganization", () => {
    it("creates a team and provisions it", async () => {
      const teamsApi = createMockTeamsApi();
      vi.mocked(teamsApi.createTeam).mockResolvedValue({ $id: "team-new", name: "Acme" });
      const functionsApi = createMockFunctionsApi();
      vi.mocked(functionsApi.createExecution).mockResolvedValue({
        responseBody: JSON.stringify({ ok: true }),
      } as never);

      const service = createAppwriteTenantService(teamsApi, functionsApi);

      const organization = await service.createOrganization("Acme");

      expect(organization).toEqual({ id: "team-new", name: "Acme" });
      expect(teamsApi.createTeam).toHaveBeenCalledWith({ name: "Acme" });
      expect(functionsApi.createExecution).toHaveBeenCalledWith(
        expect.objectContaining({
          functionId: "provision-organization",
          body: { organizationId: "team-new", displayName: "Acme" },
        }),
      );
    });

    it("still returns the organization when provisioning fails", async () => {
      const teamsApi = createMockTeamsApi();
      vi.mocked(teamsApi.createTeam).mockResolvedValue({ $id: "team-new", name: "Acme" });
      const functionsApi = createMockFunctionsApi();
      vi.mocked(functionsApi.createExecution).mockRejectedValue(new Error("boom"));

      const service = createAppwriteTenantService(teamsApi, functionsApi);

      await expect(service.createOrganization("Acme")).resolves.toEqual({
        id: "team-new",
        name: "Acme",
      });
    });
  });

  describe("getProfile", () => {
    it("fetches organization profile", async () => {
      const api = createMockFunctionsApi();
      vi.mocked(api.createExecution).mockResolvedValue({
        responseBody: JSON.stringify({ displayName: "Test Org", primaryColor: "#ff0000" }),
      } as never);
      const service = createAppwriteTenantService(createMockTeamsApi(), api);
      const profile = await service.getProfile("org-123");
      expect(profile?.primaryColor).toBe("#ff0000");
      expect(api.createExecution).toHaveBeenCalledWith(
        expect.objectContaining({
          functionId: "get-organization-profile",
          body: { organizationId: "org-123" },
        }),
      );
    });

    it("returns null on error", async () => {
      const api = createMockFunctionsApi();
      vi.mocked(api.createExecution).mockRejectedValueOnce(new Error("fail"));
      const service = createAppwriteTenantService(createMockTeamsApi(), api);
      const profile = await service.getProfile("org-123");
      expect(profile).toBeNull();
    });
  });
});
