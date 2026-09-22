import { describe, it, expect, vi, beforeEach } from "vitest";

const mockCreateRow = vi.fn().mockResolvedValue({ $id: "test" });

vi.mock("node-appwrite", () => {
  return {
    Client: vi.fn().mockImplementation(function () {
      return {
        setEndpoint: vi.fn().mockReturnThis(),
        setProject: vi.fn().mockReturnThis(),
        setKey: vi.fn().mockReturnThis(),
      };
    }),
    TablesDB: vi.fn().mockImplementation(function () {
      return {
        createRow: mockCreateRow,
      };
    }),
    Permission: {
      read: vi.fn((role: string) => `read(${role})`),
      create: vi.fn((role: string) => `create(${role})`),
      update: vi.fn((role: string) => `update(${role})`),
      delete: vi.fn((role: string) => `delete(${role})`),
    },
    Role: {
      users: vi.fn(() => "users"),
      team: vi.fn((id: string, role?: string) => `team(${id},${role ?? ""})`),
    },
    TablesDBIndexType: {
      Key: "key",
      Unique: "unique",
      Fulltext: "fulltext",
      Spatial: "spatial",
    },
    OrderBy: {
      Asc: "asc",
      Desc: "desc",
    },
  };
});

import { seedData } from "../seeds.js";
import { SEED_PERMISSIONS } from "../config.js";

describe("seedData", () => {
  const config = {
    endpoint: "https://test.appwrite.io/v1",
    projectId: "test-project",
    apiKey: "test-api-key",
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("is a function", () => {
    expect(typeof seedData).toBe("function");
  });

  it("inserts the admin and client applications, and no customer portal", async () => {
    await seedData(config);

    const appCalls = mockCreateRow.mock.calls.filter((call: any[]) => call[1] === "applications");
    expect(appCalls.map((call: any[]) => call[2])).toEqual(["app_admin", "app_client"]);
  });

  it("inserts every seeded permission", async () => {
    await seedData(config);

    const permCalls = mockCreateRow.mock.calls.filter((call: any[]) => call[1] === "permissions");
    expect(permCalls).toHaveLength(SEED_PERMISSIONS.length);
    expect(permCalls.map((call: any[]) => call[3].key)).toContain("organizations.create");
    expect(permCalls.map((call: any[]) => call[3].key)).toContain("users.read");
    expect(permCalls.map((call: any[]) => call[3].key)).toContain("users.create");
    expect(permCalls.map((call: any[]) => call[3].key)).toContain("users.manage_permissions");
  });

  it("inserts 8 features", async () => {
    await seedData(config);

    const featCalls = mockCreateRow.mock.calls.filter((call: any[]) => call[1] === "features");
    expect(featCalls).toHaveLength(8);
  });

  it("handles 409 conflict (document already exists)", async () => {
    mockCreateRow.mockRejectedValueOnce({ code: 409 });

    await expect(seedData(config)).resolves.not.toThrow();
  });

  it("propagates non-409 errors", async () => {
    mockCreateRow.mockRejectedValueOnce({ code: 500, message: "Server error" });

    await expect(seedData(config)).rejects.toThrow();
  });
});
