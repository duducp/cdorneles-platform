import { createDatabase } from "./database.js";
import { seedData } from "./seeds.js";
import { createBuckets } from "./buckets.js";
import type { AppwriteConfig } from "./client.js";

export { createDatabase } from "./database.js";
export { seedData } from "./seeds.js";
export { createBuckets } from "./buckets.js";
export { DATABASE_ID, DATABASE_NAME, TABLES, SEED_APPLICATIONS, SEED_PERMISSIONS, SEED_FEATURES, STORAGE_BUCKETS } from "./config.js";
export type { AppwriteConfig } from "./client.js";
export type { TableDef, AttributeDef, SeedDef, BucketDef } from "./config.js";

export type ProvisioningConfig = AppwriteConfig;

export async function runProvisioning(config: ProvisioningConfig): Promise<void> {
  console.log("[provisioning] Starting provisioning...");

  await createDatabase(config);
  await seedData(config);
  await createBuckets(config);

  console.log("[provisioning] Provisioning complete.");
}
