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

  it("inserts 3 applications", async () => {
    await seedData(config);

    const appCalls = mockCreateRow.mock.calls.filter(
      (call: any[]) => call[1] === "applications",
    );
    expect(appCalls).toHaveLength(3);
  });

  it("inserts 24 permissions", async () => {
    await seedData(config);

    const permCalls = mockCreateRow.mock.calls.filter(
      (call: any[]) => call[1] === "permissions",
    );
    expect(permCalls).toHaveLength(24);
  });

  it("inserts 8 features", async () => {
    await seedData(config);

    const featCalls = mockCreateRow.mock.calls.filter(
      (call: any[]) => call[1] === "features",
    );
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
