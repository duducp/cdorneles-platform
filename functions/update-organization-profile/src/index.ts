import { Client, ID, Query, TablesDB, Teams } from "node-appwrite";

import { authorize, type GrantRepo } from "./authorize";

const DATABASE_ID = "cdorneles_platform";

const client = new Client()
  .setEndpoint(process.env.APPWRITE_FUNCTION_API_ENDPOINT ?? "")
  .setProject(process.env.APPWRITE_FUNCTION_PROJECT_ID ?? "")
  .setKey(process.env.APPWRITE_FUNCTION_API_KEY ?? "");

const teams = new Teams(client);
const tables = new TablesDB(client);

const repo: GrantRepo = {
  async listMemberships(teamId) {
    const result = await teams.listMemberships(teamId);
    return result.memberships.map((membership) => ({
      userId: membership.userId,
      roles: membership.roles,
    }));
  },

  async listOrganizationRoles(organizationId) {
    const result = await tables.listRows(
      DATABASE_ID,
      "roles",
      [Query.equal("organizationId", organizationId)],
    );
    return result.rows.map((row) => ({
      id: row.$id,
      name: String(row.data.name ?? ""),
    }));
  },

  async listPermissionKeysForRoles(roleIds) {
    const keys = new Set<string>();
    for (const roleId of roleIds) {
      const result = await tables.listRows(
        DATABASE_ID,
        "role_permissions",
        [Query.equal("roleId", roleId)],
      );
      for (const row of result.rows) {
        const permission = await tables.getRow(
          DATABASE_ID,
          "permissions",
          String(row.data.permissionId),
        );
        keys.add(String(permission.data.key ?? ""));
      }
    }
    return [...keys];
  },

  async listApplicationIdsForRoles(roleIds) {
    const ids = new Set<string>();
    for (const roleId of roleIds) {
      const result = await tables.listRows(
        DATABASE_ID,
        "role_applications",
        [Query.equal("roleId", roleId)],
      );
      for (const row of result.rows) {
        const application = await tables.getRow(
          DATABASE_ID,
          "applications",
          String(row.data.applicationId),
        );
        ids.add(String(application.data.appId ?? ""));
      }
    }
    return [...ids];
  },

  async getOrganizationProfile(organizationId) {
    const result = await tables.listRows(
      DATABASE_ID,
      "organization_profiles",
      [Query.equal("organizationId", organizationId)],
    );
    const profile = result.rows[0];
    if (!profile) {
      return null;
    }
    return { active: profile.data.active !== false && profile.data.active !== undefined };
  },

  async isFeatureEnabled(organizationId, featureKey) {
    const features = await tables.listRows(
      DATABASE_ID,
      "features",
      [Query.equal("key", featureKey)],
    );
    const feature = features.rows[0];
    if (!feature) {
      return false;
    }
    const rows = await tables.listRows(
      DATABASE_ID,
      "organization_features",
      [Query.equal("organizationId", organizationId), Query.equal("featureId", feature.$id)],
    );
    const orgFeature = rows.rows[0];
    return orgFeature?.data.enabled === true;
  },
};

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

  const rows = await tables.listRows(
    DATABASE_ID,
    "organization_profiles",
    [Query.equal("organizationId", organizationId)],
  );
  const profileRow = rows.rows[0];
  if (!profileRow) {
    return res.json({ error: "forbidden", reason: "organization is not active" }, 403);
  }

  await tables.updateRow(DATABASE_ID, "organization_profiles", profileRow.$id, changes);

  await tables.createRow(DATABASE_ID, "audit_logs", ID.unique(), {
    userId,
    organizationId,
    action: "organizations.update",
    resourceType: "organization",
    resourceId: organizationId,
    metadata: JSON.stringify(changes),
    timestamp: new Date().toISOString(),
  });

  log({ action: "organizations.update", organizationId, userId, changed: Object.keys(changes) });

  return res.json({ ok: true });
}
