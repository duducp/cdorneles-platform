export { createDatabase } from "./database.js";
export { seedData } from "./seeds.js";
export { DATABASE_ID, DATABASE_NAME, TABLES, SEED_APPLICATIONS, SEED_PERMISSIONS, SEED_FEATURES } from "./config.js";
export type { DatabaseConfig } from "./database.js";
export type { TableDef, AttributeDef, SeedDef } from "./config.js";

import { createDatabase, type DatabaseConfig } from "./database.js";
import { seedData } from "./seeds.js";

export type ProvisioningConfig = DatabaseConfig;

export async function runProvisioning(config: ProvisioningConfig): Promise<void> {
  console.log("[provisioning] Starting provisioning...");

  await createDatabase(config);
  await seedData(config);

  console.log("[provisioning] Provisioning complete.");
}
