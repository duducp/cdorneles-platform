import { existsSync } from "node:fs";
import { resolve } from "node:path";

import { ID, Query, TablesDB, Teams, Users } from "node-appwrite";

import { DATABASE_ID } from "./config.js";
import { createClient, type AppwriteConfig } from "./client.js";
import { resolveProvisioningEnv } from "./env.js";

/**
 * Local-development seed: demo users, demo organizations (Appwrite Teams),
 * memberships, the per-organization roles (same shape provision-organization
 * creates) and the platform team membership for the primary user.
 *
 * Everything is idempotent (create-if-missing), so re-running is safe. Run it
 * with `pnpm seed:dev` from the repository root.
 */

const DEMO_PASSWORD = "SenhaDemo123!";

interface DemoUser {
  userId: string;
  email: string;
  name: string;
}

const DEMO_USERS: DemoUser[] = [
  { userId: "demo-owner", email: "owner@demo.local", name: "Olivia Owner" },
  { userId: "demo-admin", email: "admin@demo.local", name: "Marina Admin" },
  { userId: "demo-member", email: "member@demo.local", name: "Marco Member" },
];

const DEMO_ORGS = [
  { teamId: "demo-acme", name: "Acme Demo", displayName: "Acme Demo" },
  { teamId: "demo-globex", name: "Globex Demo", displayName: "Globex Demo" },
];

/**
 * Platform capabilities are granted outside organization roles (see
 * provision-organization's allPermissionIDs) — the wildcard role set skips
 * them. organizations.create is only reachable via the platform team.
 */
const PLATFORM_EXCLUDED = new Set([
  "perm_organizations_create",
  "perm_users_read",
  "perm_users_create",
  "perm_users_manage_permissions",
]);

/** Same shape as provision-organization's roleDefs. */
const ROLE_DEFS = [
  { name: "owner", permissions: ["*"], applications: ["app_admin", "app_client"] },
  {
    name: "admin",
    permissions: ["*"],
    applications: ["app_admin", "app_client"],
    excluded: ["perm_features_manage"],
  },
  {
    name: "member",
    // Permission KEYS (the map is key → row id).
    permissions: [
      "organizations.read",
      "customers.read",
      "orders.read",
      "invoices.read",
      "products.read",
      "roles.read",
      "features.read",
      "audit.read",
    ],
    applications: ["app_client"],
  },
];

async function ensureUser(tables: TablesDB, users: Users, demo: DemoUser): Promise<string> {
  try {
    await users.create({
      userId: demo.userId,
      email: demo.email,
      password: DEMO_PASSWORD,
      name: demo.name,
    });
    console.log(`[seed:dev] created user ${demo.email}`);
  } catch (error: unknown) {
    const code = (error as { code?: number }).code;
    if (code !== 409) throw error;
    // Already exists: guarantee a known password so the user can always log in.
    await users.updatePassword({ userId: demo.userId, password: DEMO_PASSWORD });
    console.log(`[seed:dev] user ${demo.email} already exists (password reset)`);
  }
  return demo.userId;
}

async function ensureTeam(teams: Teams, teamId: string, name: string): Promise<void> {
  try {
    await teams.create({ teamId, name });
    console.log(`[seed:dev] created team ${teamId}`);
  } catch (error: unknown) {
    const code = (error as { code?: number }).code;
    if (code !== 409) throw error;
    console.log(`[seed:dev] team ${teamId} already exists`);
  }
}

/**
 * Creates a membership already confirmed. The Node SDK's typed params dropped
 * `confirm`, but the Appwrite server still honours it on the REST endpoint
 * (it is what the CLI's `--confirm` flag sends) — so the call goes over raw
 * HTTP with the server API key. Without it the membership stays "invited" and
 * invisible to the user's Teams.list until they accept an email invite.
 */
async function createConfirmedMembership(
  config: AppwriteConfig,
  teamId: string,
  userId: string,
  email: string,
  roles: string[],
): Promise<void> {
  const response = await fetch(`${config.endpoint}/teams/${teamId}/memberships`, {
    method: "POST",
    headers: {
      "X-Appwrite-Project": config.projectId,
      "X-Appwrite-Key": config.apiKey,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ email, userId, roles, confirm: true }),
  });
  if (!response.ok) {
    const body = await response.text();
    throw new Error(`createMembership failed (${response.status}): ${body}`);
  }
}

async function ensureMembership(
  config: AppwriteConfig,
  teams: Teams,
  teamId: string,
  userId: string,
  email: string,
  roles: string[],
): Promise<void> {
  const existing = await teams.listMemberships({
    teamId,
    queries: [Query.equal("userId", userId)],
  });
  if (existing.total > 0) {
    console.log(`[seed:dev] membership ${userId}@${teamId} already exists`);
    return;
  }
  await createConfirmedMembership(config, teamId, userId, email, roles);
  console.log(`[seed:dev] added ${userId} to ${teamId} as ${roles.join(",")}`);
}

async function findPermissionIds(tables: TablesDB): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  let cursor: string | undefined;
  for (;;) {
    const page = await tables.listRows({
      databaseId: DATABASE_ID,
      tableId: "permissions",
      queries: cursor ? [Query.cursorAfter(cursor), Query.limit(100)] : [Query.limit(100)],
    });
    for (const row of page.rows) map.set(row.key, row.$id);
    if (page.rows.length < 100) break;
    cursor = page.rows.at(-1)?.$id;
  }
  return map;
}

async function rowExists(tables: TablesDB, tableId: string, queries: string[]): Promise<boolean> {
  const result = await tables.listRows({
    databaseId: DATABASE_ID,
    tableId,
    queries: [...queries, Query.limit(1)],
  });
  return result.total > 0;
}

async function ensureProfile(
  tables: TablesDB,
  organizationId: string,
  displayName: string,
): Promise<void> {
  if (
    await rowExists(tables, "organization_profiles", [
      Query.equal("organizationId", organizationId),
    ])
  ) {
    return;
  }
  await tables.createRow({
    databaseId: DATABASE_ID,
    tableId: "organization_profiles",
    rowId: ID.unique(),
    data: { organizationId, displayName, active: true },
  });
  console.log(`[seed:dev] profile created for ${organizationId}`);
}

async function ensureRoles(
  tables: TablesDB,
  organizationId: string,
  permissionIds: Map<string, string>,
): Promise<void> {
  for (const def of ROLE_DEFS) {
    const roles = await tables.listRows({
      databaseId: DATABASE_ID,
      tableId: "roles",
      queries: [
        Query.equal("organizationId", organizationId),
        Query.equal("name", def.name),
        Query.limit(1),
      ],
    });
    let roleId: string;
    if (roles.total > 0) {
      roleId = roles.rows[0]!.$id;
    } else {
      const created = await tables.createRow({
        databaseId: DATABASE_ID,
        tableId: "roles",
        rowId: ID.unique(),
        data: { organizationId, name: def.name, description: `${def.name} role` },
      });
      roleId = created.$id;
      console.log(`[seed:dev] role ${def.name} created for ${organizationId}`);
    }

    // Seeded permission rows use literal ids (`perm_customers_read`, …), so
    // the wildcard resolves to the platform-excluded set directly. `member`'s
    // list is also literal ids — no lookup needed either way.
    const permissionIdsForRole =
      def.permissions[0] === "*"
        ? [...permissionIds.values()]
        : def.permissions.map((pid) => permissionIds.get(pid)).filter((v): v is string => !!v);
    const selected =
      def.name === "admin"
        ? // Admin mirrors provision-organization: everything but
          // features.manage. Platform capabilities (organizations.create,
          // users.*) are not in the wildcard set to begin with.
          permissionIdsForRole.filter(
            (pid) => !PLATFORM_EXCLUDED.has(pid) && pid !== "perm_features_manage",
          )
        : permissionIdsForRole.filter((pid) => !PLATFORM_EXCLUDED.has(pid));

    for (const permissionId of selected) {
      if (
        await rowExists(tables, "role_permissions", [
          Query.equal("roleId", roleId),
          Query.equal("permissionId", permissionId),
        ])
      ) {
        continue;
      }
      await tables.createRow({
        databaseId: DATABASE_ID,
        tableId: "role_permissions",
        rowId: ID.unique(),
        data: { roleId, permissionId },
      });
    }

    for (const applicationId of def.applications) {
      if (
        await rowExists(tables, "role_applications", [
          Query.equal("roleId", roleId),
          Query.equal("applicationId", applicationId),
        ])
      ) {
        continue;
      }
      await tables.createRow({
        databaseId: DATABASE_ID,
        tableId: "role_applications",
        rowId: ID.unique(),
        data: { roleId, applicationId },
      });
    }
  }
}

async function ensureFeatures(tables: TablesDB, organizationId: string): Promise<void> {
  const features = await tables.listRows({
    databaseId: DATABASE_ID,
    tableId: "features",
    queries: [Query.limit(100)],
  });
  for (const feature of features.rows) {
    if (
      await rowExists(tables, "organization_features", [
        Query.equal("organizationId", organizationId),
        Query.equal("featureId", feature.$id),
      ])
    ) {
      continue;
    }
    await tables.createRow({
      databaseId: DATABASE_ID,
      tableId: "organization_features",
      rowId: ID.unique(),
      data: { organizationId, featureId: feature.$id, enabled: feature.key === "white-label" },
    });
  }
}

async function run(config: AppwriteConfig): Promise<void> {
  const client = createClient(config);
  const users = new Users(client);
  const teams = new Teams(client);
  const tables = new TablesDB(client);

  // Platform team membership for the primary demo user: grants every
  // permission/feature through resolve-grants' platform bypass (including
  // organizations.create, so the switcher's create item is visible).
  const platformTeamId = process.env.NEXT_PUBLIC_PLATFORM_TEAM_ID ?? "";

  for (const demo of DEMO_USERS) {
    await ensureUser(tables, users, demo);
  }

  const permissionIds = await findPermissionIds(tables);

  for (const org of DEMO_ORGS) {
    await ensureTeam(teams, org.teamId, org.name);
    await ensureProfile(tables, org.teamId, org.displayName);
    await ensureRoles(tables, org.teamId, permissionIds);
    await ensureFeatures(tables, org.teamId);
  }

  // Olivia: owner in both organizations (exercises the org switcher), plus
  // platform admin when the platform team is configured.
  await ensureMembership(config, teams, "demo-acme", "demo-owner", "owner@demo.local", ["owner"]);
  await ensureMembership(config, teams, "demo-globex", "demo-owner", "owner@demo.local", ["owner"]);
  await ensureMembership(config, teams, "demo-acme", "demo-admin", "admin@demo.local", ["admin"]);
  await ensureMembership(config, teams, "demo-acme", "demo-member", "member@demo.local", [
    "member",
  ]);

  if (platformTeamId) {
    await ensureTeam(teams, platformTeamId, "Platform Admins");
    await ensureMembership(config, teams, platformTeamId, "demo-owner", "owner@demo.local", []);
    console.log(`[seed:dev] demo-owner added to platform team ${platformTeamId}`);
  }

  console.log("\n[seed:dev] Done. Demo accounts (password for all):\n");
  for (const demo of DEMO_USERS) {
    console.log(`  ${demo.email.padEnd(20)} ${DEMO_PASSWORD}`);
  }
  console.log("");
}

const envFile = resolve(import.meta.dirname, "../../../.env");
if (existsSync(envFile)) {
  process.loadEnvFile(envFile);
}

const config = resolveProvisioningEnv(process.env);

if (!config) {
  console.error(
    "[seed:dev] Missing env vars. Set APPWRITE_API_KEY plus either " +
      "APPWRITE_ENDPOINT/APPWRITE_PROJECT_ID or NEXT_PUBLIC_APPWRITE_ENDPOINT/NEXT_PUBLIC_APPWRITE_PROJECT_ID.",
  );
  process.exit(1);
}

try {
  await run(config);
} catch (error) {
  console.error("[seed:dev] Fatal error:", error);
  process.exit(1);
}
