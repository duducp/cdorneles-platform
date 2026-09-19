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
      teams: [
        { $id: "t1", name: "Acme" },
        { $id: "t2", name: "Globex" },
      ],
    });

    const api = createTeamsApi(client);

    await expect(api.listTeams()).resolves.toEqual([
      { $id: "t1", name: "Acme" },
      { $id: "t2", name: "Globex" },
    ]);
  });

  it("maps memberships for a team", async () => {
    mocks.teams.listMemberships.mockResolvedValue({
      memberships: [{ $id: "m1", teamId: "t1", userId: "u1", roles: ["owner"] }],
    });

    const api = createTeamsApi(client);
    const memberships = await api.listMemberships("t1");

    expect(mocks.teams.listMemberships).toHaveBeenCalledWith("t1");
    expect(memberships).toEqual([{ $id: "m1", teamId: "t1", userId: "u1", roles: ["owner"] }]);
  });

  it("wraps failures in ApiError", async () => {
    mocks.teams.list.mockRejectedValue(new AppwriteException("nope", 401, "user_unauthorized"));

    const api = createTeamsApi(client);

    await expect(api.listTeams()).rejects.toBeInstanceOf(ApiError);
  });
});
