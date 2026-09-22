import { describe, it, expect, vi, beforeEach } from "vitest";

const mockCreate = vi.fn().mockResolvedValue({ $id: "test" });
const mockCreateTable = vi.fn().mockResolvedValue({ $id: "test" });
const mockCreateStringColumn = vi.fn().mockResolvedValue({});
const mockCreateIntegerColumn = vi.fn().mockResolvedValue({});
const mockCreateBooleanColumn = vi.fn().mockResolvedValue({});
const mockCreateDatetimeColumn = vi.fn().mockResolvedValue({});
const mockCreateEnumColumn = vi.fn().mockResolvedValue({});

const mockCreateIndex = vi.fn().mockResolvedValue({});

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
        create: mockCreate,
        createTable: mockCreateTable,
        createStringColumn: mockCreateStringColumn,
        createIntegerColumn: mockCreateIntegerColumn,
        createBooleanColumn: mockCreateBooleanColumn,
        createDatetimeColumn: mockCreateDatetimeColumn,
        createEnumColumn: mockCreateEnumColumn,
        createIndex: mockCreateIndex,
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

import { createDatabase } from "../database.js";

describe("createDatabase", () => {
  const config = {
    endpoint: "https://test.appwrite.io/v1",
    projectId: "test-project",
    apiKey: "test-api-key",
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("is a function", () => {
    expect(typeof createDatabase).toBe("function");
  });

  it("creates database with correct ID and name", async () => {
    await createDatabase(config);

    expect(mockCreate).toHaveBeenCalledWith("cdorneles_platform", "Cdorneles Platform");
  });

  it("creates all 10 tables", async () => {
    await createDatabase(config);

    expect(mockCreateTable).toHaveBeenCalledTimes(10);
  });

  it("creates indexes for each table", async () => {
    await createDatabase(config);

    expect(mockCreateIndex).toHaveBeenCalled();
  });

  it("handles 409 conflict (database already exists)", async () => {
    mockCreate.mockRejectedValueOnce({ code: 409 });

    await expect(createDatabase(config)).resolves.not.toThrow();
  });

  it("propagates non-409 errors", async () => {
    mockCreate.mockRejectedValueOnce({ code: 500, message: "Server error" });

    await expect(createDatabase(config)).rejects.toThrow();
  });
});
