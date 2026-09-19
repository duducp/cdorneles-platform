import { Client, ID, Query, TablesDB, Teams } from "node-appwrite";

import { authorize, type GrantRepo } from "./authorize";

const DATABASE_ID = "cdorneles_platform";

function createRepo(client: Client): GrantRepo {
  const teams = new Teams(client);
  const tables = new TablesDB(client);

  return {
    async listMemberships(teamId) {
      const result = await teams.listMemberships({ teamId });
      return result.memberships.map((membership) => ({
        userId: membership.userId,
        roles: membership.roles,
      }));
    },

    async listOrganizationRoles(organizationId) {
      const result = await tables.listRows({
        databaseId: DATABASE_ID,
        tableId: "roles",
        queries: [Query.equal("organizationId", organizationId)],
      });
      return result.rows.map((row) => ({
        id: row.$id,
        name: String(row.name ?? ""),
      }));
    },

    async listPermissionKeysForRoles(roleIds) {
      const keys = new Set<string>();
      for (const roleId of roleIds) {
        const result = await tables.listRows({
          databaseId: DATABASE_ID,
          tableId: "role_permissions",
          queries: [Query.equal("roleId", roleId)],
        });
        for (const row of result.rows) {
          const permission = await tables.getRow({
            databaseId: DATABASE_ID,
            tableId: "permissions",
            rowId: String(row.permissionId),
          });
          keys.add(String(permission.key ?? ""));
        }
      }
      return [...keys];
    },

    async listApplicationIdsForRoles(roleIds) {
      const ids = new Set<string>();
      for (const roleId of roleIds) {
        const result = await tables.listRows({
          databaseId: DATABASE_ID,
          tableId: "role_applications",
          queries: [Query.equal("roleId", roleId)],
        });
        for (const row of result.rows) {
          const application = await tables.getRow({
            databaseId: DATABASE_ID,
            tableId: "applications",
            rowId: String(row.applicationId),
          });
          ids.add(String(application.appId ?? ""));
        }
      }
      return [...ids];
    },

    async getOrganizationProfile(organizationId) {
      const result = await tables.listRows({
        databaseId: DATABASE_ID,
        tableId: "organization_profiles",
        queries: [Query.equal("organizationId", organizationId)],
      });
      const profile = result.rows[0];
      if (!profile) {
        return null;
      }
      return { active: profile.active !== false };
    },

    async isFeatureEnabled(organizationId, featureKey) {
      const features = await tables.listRows({
        databaseId: DATABASE_ID,
        tableId: "features",
        queries: [Query.equal("key", featureKey)],
      });
      const feature = features.rows[0];
      if (!feature) {
        return false;
      }
      const rows = await tables.listRows({
        databaseId: DATABASE_ID,
        tableId: "organization_features",
        queries: [
          Query.equal("organizationId", organizationId),
          Query.equal("featureId", feature.$id),
        ],
      });
      const orgFeature = rows.rows[0];
      return orgFeature?.enabled === true;
    },
  };
}

const PROFILE_FIELDS = [
  "displayName",
  "primaryColor",
  "secondaryColor",
  "logoLight",
  "logoDark",
  "favicon",
] as const;

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

  const userId = req.headers["x-appwrite-user-id"] ?? "";
  const organizationId = typeof body.organizationId === "string" ? body.organizationId : "";
  const applicationId = typeof body.applicationId === "string" ? body.applicationId : "";
  if (!organizationId || !applicationId) {
    return res.json(
      { error: "bad_request", reason: "organizationId and applicationId are required" },
      400,
    );
  }

  // The per-execution API key reaches the runtime as the `x-appwrite-key`
  // request header (open-runtimes v5); it is not injected as an env var.
  const client = new Client()
    .setEndpoint(process.env.APPWRITE_FUNCTION_API_ENDPOINT ?? "")
    .setProject(process.env.APPWRITE_FUNCTION_PROJECT_ID ?? "")
    .setKey(req.headers["x-appwrite-key"] ?? "");
  const repo = createRepo(client);
  const tables = new TablesDB(client);

  const decision = await authorize(
    {
      userId,
      organizationId,
      applicationId,
      requiredPermission: "organizations.update",
      requiredFeature: "white-label",
    },
    repo,
  );

  if (!decision.ok) {
    log({ action: "organizations.update", decision });
    return res.json(
      { error: decision.status === 401 ? "unauthorized" : "forbidden", reason: decision.reason },
      decision.status,
    );
  }

  const changes: Record<string, unknown> = {};
  for (const field of PROFILE_FIELDS) {
    if (typeof body[field] === "string") {
      changes[field] = body[field];
    }
  }
  if (Object.keys(changes).length === 0) {
    return res.json({ error: "bad_request", reason: "no profile fields to update" }, 400);
  }

  const rows = await tables.listRows({
    databaseId: DATABASE_ID,
    tableId: "organization_profiles",
    queries: [Query.equal("organizationId", organizationId)],
  });
  const profileRow = rows.rows[0];
  if (!profileRow) {
    return res.json({ error: "forbidden", reason: "organization is not active" }, 403);
  }

  await tables.updateRow({
    databaseId: DATABASE_ID,
    tableId: "organization_profiles",
    rowId: profileRow.$id,
    data: changes,
  });

  await tables.createRow({
    databaseId: DATABASE_ID,
    tableId: "audit_logs",
    rowId: ID.unique(),
    data: {
      userId,
      organizationId,
      action: "organizations.update",
      resourceType: "organization",
      resourceId: organizationId,
      metadata: JSON.stringify(changes),
      timestamp: new Date().toISOString(),
    },
  });

  log({ action: "organizations.update", organizationId, userId, changed: Object.keys(changes) });

  return res.json({ ok: true });
}
