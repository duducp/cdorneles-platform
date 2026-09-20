import { beforeEach, describe, expect, it, vi } from "vitest";

const listMemberships = vi.fn();
const listRows = vi.fn();
const getRow = vi.fn();

vi.mock("node-appwrite", () => {
  class MockClient {
    setEndpoint() { return this; }
    setProject() { return this; }
    setKey() { return this; }
  }
  class MockTeams {
    listMemberships = listMemberships;
  }
  class MockTablesDB {
    listRows = listRows;
    getRow = getRow;
  }
  return {
    Client: MockClient,
    Teams: MockTeams,
    TablesDB: MockTablesDB,
    Query: { equal: (attr: string, val: unknown) => `equal:${attr}:${val}` },
    ID: { unique: () => "unique-id" },
  };
});

function createCtx(body: Record<string, unknown>, headers: Record<string, string> = {}) {
  return {
    req: {
      body: JSON.stringify(body),
      headers: {
        "x-appwrite-user-id": "u1",
        "x-appwrite-key": "test-key",
        ...headers,
      },
    },
    res: {
      json: vi.fn().mockReturnThis(),
    },
    log: vi.fn(),
  };
}

describe("resolve-grants function", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns permissions and features for a valid request", async () => {
    const ctx = createCtx({
      userId: "u1",
      organizationId: "org-1",
      applicationId: "admin",
    });

    listMemberships.mockResolvedValue({
      memberships: [{ userId: "u1", roles: ["owner"] }],
    });

    listRows.mockImplementation(async ({ tableId }: { tableId: string }) => {
      if (tableId === "roles") {
        return { rows: [{ $id: "role-1", name: "owner" }] };
      }
      if (tableId === "role_permissions") {
        return { rows: [{ permissionId: "perm-1" }] };
      }
      if (tableId === "role_applications") {
        return { rows: [{ applicationId: "app-1" }] };
      }
      if (tableId === "organization_features") {
        return { rows: [{ featureId: "feat-1" }] };
      }
      return { rows: [] };
    });

    getRow.mockImplementation(async ({ tableId }: { tableId: string }) => {
      if (tableId === "permissions") {
        return { key: "customers.read" };
      }
      if (tableId === "applications") {
        return { appId: "admin" };
      }
      if (tableId === "features") {
        return { key: "white-label" };
      }
      return {};
    });

    const handler = (await import("./index")).default;
    await handler(ctx as any);

    expect(ctx.res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        permissions: ["customers.read"],
        features: ["white-label"],
      }),
    );
  });

  it("returns 401 when x-appwrite-user-id is missing", async () => {
    const ctx = createCtx(
      { userId: "u1", organizationId: "org-1", applicationId: "admin" },
      { "x-appwrite-user-id": "" },
    );

    const handler = (await import("./index")).default;
    await handler(ctx as any);

    expect(ctx.res.json).toHaveBeenCalledWith(
      expect.objectContaining({ error: "unauthorized" }),
      401,
    );
  });

  it("returns 403 when userId mismatches header", async () => {
    const ctx = createCtx({
      userId: "other-user",
      organizationId: "org-1",
      applicationId: "admin",
    });

    const handler = (await import("./index")).default;
    await handler(ctx as any);

    expect(ctx.res.json).toHaveBeenCalledWith(
      expect.objectContaining({ error: "forbidden", reason: "userId mismatch" }),
      403,
    );
  });

  it("returns 403 when user is not a member", async () => {
    const ctx = createCtx({
      userId: "u1",
      organizationId: "org-1",
      applicationId: "admin",
    });

    listMemberships.mockResolvedValue({
      memberships: [{ userId: "other-user", roles: ["owner"] }],
    });

    const handler = (await import("./index")).default;
    await handler(ctx as any);

    expect(ctx.res.json).toHaveBeenCalledWith(
      expect.objectContaining({ error: "forbidden", reason: "not a member of the organization" }),
      403,
    );
  });

  it("returns empty grants when no roles match", async () => {
    const ctx = createCtx({
      userId: "u1",
      organizationId: "org-1",
      applicationId: "admin",
    });

    listMemberships.mockResolvedValue({
      memberships: [{ userId: "u1", roles: ["owner"] }],
    });

    listRows.mockImplementation(async ({ tableId }: { tableId: string }) => {
      if (tableId === "roles") {
        return { rows: [] };
      }
      return { rows: [] };
    });

    const handler = (await import("./index")).default;
    await handler(ctx as any);

    expect(ctx.res.json).toHaveBeenCalledWith({ permissions: [], features: [] });
  });
});
