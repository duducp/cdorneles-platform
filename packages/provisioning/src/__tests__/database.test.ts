import { describe, it, expect, vi, beforeEach } from "vitest";

const mockCreate = vi.fn().mockResolvedValue({ $id: "test" });
const mockList = vi.fn().mockResolvedValue({ databases: [] });
const mockCreateCollection = vi.fn().mockResolvedValue({ $id: "test" });
const mockCreateStringAttribute = vi.fn().mockResolvedValue({});
const mockCreateIntegerAttribute = vi.fn().mockResolvedValue({});
const mockCreateBooleanAttribute = vi.fn().mockResolvedValue({});
const mockCreateDatetimeAttribute = vi.fn().mockResolvedValue({});
const mockCreateEnumAttribute = vi.fn().mockResolvedValue({});

vi.mock("node-appwrite", () => {
  return {
    Client: vi.fn().mockImplementation(function () {
      return {
        setEndpoint: vi.fn().mockReturnThis(),
        setProject: vi.fn().mockReturnThis(),
        setKey: vi.fn().mockReturnThis(),
      };
    }),
    Databases: vi.fn().mockImplementation(function () {
      return {
        create: mockCreate,
        list: mockList,
        createCollection: mockCreateCollection,
        createStringAttribute: mockCreateStringAttribute,
        createIntegerAttribute: mockCreateIntegerAttribute,
        createBooleanAttribute: mockCreateBooleanAttribute,
        createDatetimeAttribute: mockCreateDatetimeAttribute,
        createEnumAttribute: mockCreateEnumAttribute,
      };
    }),
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

    expect(mockCreate).toHaveBeenCalledWith(
      "cdorneles_platform",
      "Cdorneles Platform",
    );
  });

  it("creates all 10 tables", async () => {
    await createDatabase(config);

    expect(mockCreateCollection).toHaveBeenCalledTimes(10);
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
