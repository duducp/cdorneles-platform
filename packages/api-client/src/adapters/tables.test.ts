import { AppwriteException, type Client } from "appwrite";
import type * as Appwrite from "appwrite";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ApiError } from "../errors";
import { createTablesApi } from "./tables";

const mocks = vi.hoisted(() => ({
  tables: {
    listRows: vi.fn(),
    getRow: vi.fn(),
  },
}));

vi.mock("appwrite", async (importOriginal) => {
  const actual = await importOriginal<typeof Appwrite>();
  return {
    ...actual,
    TablesDB: vi.fn(function TablesDB() {
      return mocks.tables;
    }),
  };
});

const client = {} as Client;

beforeEach(() => {
  vi.clearAllMocks();
});

describe("createTablesApi", () => {
  it("lists rows with the given queries", async () => {
    mocks.tables.listRows.mockResolvedValue({
      total: 1,
      rows: [
        {
          $id: "r1",
          $createdAt: "2026-01-01T00:00:00.000Z",
          $updatedAt: "2026-01-01T00:00:00.000Z",
          $permissions: ['read("team:t1")'],
          $databaseId: "db",
          $tableId: "tbl",
          $sequence: "1",
          name: "Acme",
        },
      ],
    });

    const api = createTablesApi(client);
    const rows = await api.listRows({
      databaseId: "db",
      tableId: "tbl",
      queries: ["limit(10)"],
    });

    expect(mocks.tables.listRows).toHaveBeenCalledWith({
      databaseId: "db",
      tableId: "tbl",
      queries: ["limit(10)"],
    });
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      $id: "r1",
      $createdAt: "2026-01-01T00:00:00.000Z",
      $updatedAt: "2026-01-01T00:00:00.000Z",
      name: "Acme",
    });
    expect(rows[0]).toHaveProperty("$permissions");
  });

  it("gets a single row", async () => {
    mocks.tables.getRow.mockResolvedValue({
      $id: "r1",
      $createdAt: "2026-01-01T00:00:00.000Z",
      $updatedAt: "2026-01-01T00:00:00.000Z",
      $permissions: ['read("team:t1")'],
      $databaseId: "db",
      $tableId: "tbl",
      $sequence: "1",
      name: "Acme",
    });

    const api = createTablesApi(client);
    const row = await api.getRow({ databaseId: "db", tableId: "tbl", rowId: "r1" });

    expect(mocks.tables.getRow).toHaveBeenCalledWith({
      databaseId: "db",
      tableId: "tbl",
      rowId: "r1",
    });
    expect(row).toMatchObject({
      $id: "r1",
      $createdAt: "2026-01-01T00:00:00.000Z",
      $updatedAt: "2026-01-01T00:00:00.000Z",
      name: "Acme",
    });
    expect(row).toHaveProperty("$permissions");
  });

  it("lists rows without queries", async () => {
    mocks.tables.listRows.mockResolvedValue({ total: 0, rows: [] });

    const api = createTablesApi(client);

    await expect(api.listRows({ databaseId: "db", tableId: "tbl" })).resolves.toEqual([]);
    expect(mocks.tables.listRows).toHaveBeenCalledWith(
      expect.objectContaining({ databaseId: "db", tableId: "tbl" }),
    );
  });

  it("wraps listRows failures in ApiError", async () => {
    mocks.tables.listRows.mockRejectedValue(new AppwriteException("nope", 404, "row_not_found"));

    const api = createTablesApi(client);

    await expect(api.listRows({ databaseId: "db", tableId: "tbl" })).rejects.toBeInstanceOf(
      ApiError,
    );
  });

  it("wraps getRow failures in ApiError", async () => {
    mocks.tables.getRow.mockRejectedValue(new AppwriteException("nope", 404, "row_not_found"));

    const api = createTablesApi(client);

    await expect(
      api.getRow({ databaseId: "db", tableId: "tbl", rowId: "r1" }),
    ).rejects.toBeInstanceOf(ApiError);
  });
});
