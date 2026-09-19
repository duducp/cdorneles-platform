import { AppwriteException, type Client } from "appwrite";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ApiError } from "../errors";
import { createTeamsApi } from "./teams";

const mocks = vi.hoisted(() => ({
  teams: {
    list: vi.fn(),
    listMemberships: vi.fn(),
  },
}));

vi.mock("appwrite", async (importOriginal) => {
  const actual = await importOriginal<typeof import("appwrite")>();
  return {
    ...actual,
    Teams: vi.fn(function Teams() {
      return mocks.teams;
    }),
  };
});

const client = {} as Client;

beforeEach(() => {
  vi.clearAllMocks();
});

describe("createTeamsApi", () => {
  it("maps teams", async () => {
    mocks.teams.list.mockResolvedValue({
      total: 2,
      teams: [
        {
          $id: "t1",
          name: "Acme",
          $createdAt: "2026-01-01T00:00:00.000Z",
          $updatedAt: "2026-01-02T00:00:00.000Z",
          total: 3,
          prefs: { plan: "pro" },
        },
        {
          $id: "t2",
          name: "Globex",
          $createdAt: "2026-01-01T00:00:00.000Z",
          $updatedAt: "2026-01-02T00:00:00.000Z",
          total: 1,
          prefs: { plan: "free" },
        },
      ],
    });

    const api = createTeamsApi(client);
    const teams = await api.listTeams();

    expect(mocks.teams.list).toHaveBeenCalledOnce();
    expect(teams).toEqual([
      { $id: "t1", name: "Acme" },
      { $id: "t2", name: "Globex" },
    ]);
    expect(teams[0]).not.toHaveProperty("prefs");
    expect(teams[0]).not.toHaveProperty("$createdAt");
  });

  it("maps memberships for a team", async () => {
    mocks.teams.listMemberships.mockResolvedValue({
      memberships: [
        {
          $id: "m1",
          teamId: "t1",
          userId: "u1",
          roles: ["owner"],
          userName: "Ada",
          userEmail: "ada@example.com",
          userPhone: "+15551212",
          mfa: true,
          teamName: "Acme",
          invited: "2026-01-01T00:00:00.000Z",
          joined: "2026-01-02T00:00:00.000Z",
          confirm: true,
        },
      ],
    });

    const api = createTeamsApi(client);
    const memberships = await api.listMemberships("t1");

    expect(mocks.teams.listMemberships).toHaveBeenCalledWith({ teamId: "t1" });
    expect(memberships).toEqual([{ $id: "m1", teamId: "t1", userId: "u1", roles: ["owner"] }]);
    expect(memberships[0]).not.toHaveProperty("userEmail");
    expect(memberships[0]).not.toHaveProperty("userPhone");
    expect(memberships[0]).not.toHaveProperty("mfa");
  });

  it("wraps failures in ApiError", async () => {
    mocks.teams.list.mockRejectedValue(new AppwriteException("nope", 401, "user_unauthorized"));

    const api = createTeamsApi(client);

    await expect(api.listTeams()).rejects.toBeInstanceOf(ApiError);
  });

  it("wraps membership failures in ApiError", async () => {
    mocks.teams.listMemberships.mockRejectedValue(
      new AppwriteException("nope", 404, "team_not_found"),
    );

    const api = createTeamsApi(client);

    await expect(api.listMemberships("t1")).rejects.toBeInstanceOf(ApiError);
  });
});
