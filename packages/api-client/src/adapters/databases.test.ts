import { AppwriteException, type Client } from "appwrite";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ApiError } from "../errors";
import { createDatabasesApi } from "./databases";

const mocks = vi.hoisted(() => ({
  databases: {
    listDocuments: vi.fn(),
    getDocument: vi.fn(),
  },
}));

vi.mock("appwrite", async (importOriginal) => {
  const actual = await importOriginal<typeof import("appwrite")>();
  return {
    ...actual,
    Databases: vi.fn(function Databases() {
      return mocks.databases;
    }),
  };
});

const client = {} as Client;

beforeEach(() => {
  vi.clearAllMocks();
});

describe("createDatabasesApi", () => {
  it("lists documents with the given queries", async () => {
    mocks.databases.listDocuments.mockResolvedValue({
      total: 1,
      documents: [
        {
          $id: "d1",
          $createdAt: "2026-01-01T00:00:00.000Z",
          $updatedAt: "2026-01-01T00:00:00.000Z",
          $permissions: ['read("team:t1")'],
          $databaseId: "db",
          $collectionId: "col",
          name: "Acme",
        },
      ],
    });

    const api = createDatabasesApi(client);
    const documents = await api.listDocuments({
      databaseId: "db",
      collectionId: "col",
      queries: ["limit(10)"],
    });

    expect(mocks.databases.listDocuments).toHaveBeenCalledWith("db", "col", ["limit(10)"]);
    expect(documents).toHaveLength(1);
    expect(documents[0]).toMatchObject({
      $id: "d1",
      $createdAt: "2026-01-01T00:00:00.000Z",
      $updatedAt: "2026-01-01T00:00:00.000Z",
      name: "Acme",
    });
    expect(documents[0]).toHaveProperty("$permissions");
  });

  it("gets a single document", async () => {
    mocks.databases.getDocument.mockResolvedValue({
      $id: "d1",
      $createdAt: "2026-01-01T00:00:00.000Z",
      $updatedAt: "2026-01-01T00:00:00.000Z",
      $permissions: ['read("team:t1")'],
      $databaseId: "db",
      $collectionId: "col",
      name: "Acme",
    });

    const api = createDatabasesApi(client);
    const document = await api.getDocument({
      databaseId: "db",
      collectionId: "col",
      documentId: "d1",
    });

    expect(mocks.databases.getDocument).toHaveBeenCalledWith("db", "col", "d1");
    expect(document).toMatchObject({
      $id: "d1",
      $createdAt: "2026-01-01T00:00:00.000Z",
      $updatedAt: "2026-01-01T00:00:00.000Z",
      name: "Acme",
    });
    expect(document).toHaveProperty("$permissions");
  });

  it("lists documents without queries", async () => {
    mocks.databases.listDocuments.mockResolvedValue({ total: 0, documents: [] });

    const api = createDatabasesApi(client);

    await expect(api.listDocuments({ databaseId: "db", collectionId: "col" })).resolves.toEqual([]);
    expect(mocks.databases.listDocuments).toHaveBeenCalledWith("db", "col", undefined);
  });

  it("wraps listDocuments failures in ApiError", async () => {
    mocks.databases.listDocuments.mockRejectedValue(
      new AppwriteException("nope", 404, "document_not_found"),
    );

    const api = createDatabasesApi(client);

    await expect(
      api.listDocuments({ databaseId: "db", collectionId: "col" }),
    ).rejects.toBeInstanceOf(ApiError);
  });

  it("wraps getDocument failures in ApiError", async () => {
    mocks.databases.getDocument.mockRejectedValue(
      new AppwriteException("nope", 404, "document_not_found"),
    );

    const api = createDatabasesApi(client);

    await expect(
      api.getDocument({ databaseId: "db", collectionId: "col", documentId: "d1" }),
    ).rejects.toBeInstanceOf(ApiError);
  });
});
