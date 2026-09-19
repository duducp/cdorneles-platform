import { TablesDB } from "node-appwrite";
import {
  DATABASE_ID,
  SEED_APPLICATIONS,
  SEED_PERMISSIONS,
  SEED_FEATURES,
  type SeedDef,
} from "./config.js";
import { createClient, type AppwriteConfig } from "./client.js";

function createTablesDbApi(config: AppwriteConfig): TablesDB {
  return new TablesDB(createClient(config));
}

async function seedTable(
  tablesDb: TablesDB,
  tableId: string,
  seeds: SeedDef[],
): Promise<void> {
  for (const seed of seeds) {
    try {
      await tablesDb.createRow(DATABASE_ID, tableId, seed.id, seed.data);
      console.log(`[provisioning]   Seeded ${tableId}/${seed.id}`);
    } catch (error: unknown) {
      const code = (error as { code?: number }).code;
      if (code === 409) {
        // Row already exists, skip
      } else {
        throw error;
      }
    }
  }
}

export async function seedData(config: AppwriteConfig): Promise<void> {
  const tablesDb = createTablesDbApi(config);

  console.log("[provisioning] Seeding applications...");
  await seedTable(tablesDb, "applications", SEED_APPLICATIONS);

  console.log("[provisioning] Seeding permissions...");
  await seedTable(tablesDb, "permissions", SEED_PERMISSIONS);

  console.log("[provisioning] Seeding features...");
  await seedTable(tablesDb, "features", SEED_FEATURES);

  console.log("[provisioning] Seeds complete.");
}
