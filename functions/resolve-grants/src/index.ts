import { Client, Query, TablesDB, Teams } from "node-appwrite";

const DATABASE_ID = "cdorneles_platform";

interface Context {
  req: { body: string; headers: Record<string, string> };
  res: { json(value: unknown, status?: number): unknown };
  log: (message: unknown) => void;
}

export default async function ({ req, res, log }: Context) {
  let body: Record<string, unknown>;
  try {
    body = JSON.parse(req.body);
  } catch {
    return res.json({ error: "bad_request", reason: "invalid JSON" }, 400);
  }

  const headerUserId = req.headers["x-appwrite-user-id"] ?? "";
  const bodyUserId = typeof body.userId === "string" ? body.userId : "";
  const organizationId = typeof body.organizationId === "string" ? body.organizationId : "";
  const applicationId = typeof body.applicationId === "string" ? body.applicationId : "";

  if (!headerUserId) {
    return res.json({ error: "unauthorized", reason: "missing user identity" }, 401);
  }

  if (!bodyUserId || headerUserId !== bodyUserId) {
    return res.json({ error: "forbidden", reason: "userId mismatch" }, 403);
  }

  if (!organizationId || !applicationId) {
    return res.json(
      { error: "bad_request", reason: "organizationId and applicationId are required" },
      400,
    );
  }

  const client = new Client()
    .setEndpoint(process.env.APPWRITE_FUNCTION_API_ENDPOINT ?? "")
    .setProject(process.env.APPWRITE_FUNCTION_PROJECT_ID ?? "")
    .setKey(req.headers["x-appwrite-key"] ?? "");

  const teams = new Teams(client);
  const tables = new TablesDB(client);

  const membershipResult = await teams.listMemberships({ teamId: organizationId });
  const membership = membershipResult.memberships.find((m) => m.userId === headerUserId);
  if (!membership) {
    return res.json({ error: "forbidden", reason: "not a member of the organization" }, 403);
  }

  const roleRows = await tables.listRows({
    databaseId: DATABASE_ID,
    tableId: "roles",
    queries: [Query.equal("organizationId", organizationId)],
  });

  const roleIds = roleRows.rows
    .filter((row) => membership.roles.includes(String(row.name ?? "")))
    .map((row) => row.$id);

  if (roleIds.length === 0) {
    log({ reason: "no matching roles", userId: headerUserId, organizationId });
    return res.json({ permissions: [], features: [] });
  }

  const permissionKeys = new Set<string>();
  for (const roleId of roleIds) {
    const permRows = await tables.listRows({
      databaseId: DATABASE_ID,
      tableId: "role_permissions",
      queries: [Query.equal("roleId", roleId)],
    });
    for (const row of permRows.rows) {
      const perm = await tables.getRow({
        databaseId: DATABASE_ID,
        tableId: "permissions",
        rowId: String(row.permissionId),
      });
      permissionKeys.add(String(perm.key ?? ""));
    }
  }

  const appIds = new Set<string>();
  for (const roleId of roleIds) {
    const appRows = await tables.listRows({
      databaseId: DATABASE_ID,
      tableId: "role_applications",
      queries: [Query.equal("roleId", roleId)],
    });
    for (const row of appRows.rows) {
      const app = await tables.getRow({
        databaseId: DATABASE_ID,
        tableId: "applications",
        rowId: String(row.applicationId),
      });
      appIds.add(String(app.appId ?? ""));
    }
  }

  if (!appIds.has(applicationId)) {
    log({ reason: "missing application access", userId: headerUserId, applicationId });
    return res.json(
      { error: "forbidden", reason: `missing application access: ${applicationId}` },
      403,
    );
  }

  const featureKeys = new Set<string>();
  const orgFeatureRows = await tables.listRows({
    databaseId: DATABASE_ID,
    tableId: "organization_features",
    queries: [Query.equal("organizationId", organizationId), Query.equal("enabled", true)],
  });
  for (const row of orgFeatureRows.rows) {
    const feature = await tables.getRow({
      databaseId: DATABASE_ID,
      tableId: "features",
      rowId: String(row.featureId),
    });
    featureKeys.add(String(feature.key ?? ""));
  }

  log({
    userId: headerUserId,
    organizationId,
    applicationId,
    permissions: permissionKeys.size,
    features: featureKeys.size,
  });

  return res.json({
    permissions: [...permissionKeys],
    features: [...featureKeys],
  });
}
