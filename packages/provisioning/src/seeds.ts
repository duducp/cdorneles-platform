import { Client, Databases } from "node-appwrite";
import {
  DATABASE_ID,
  SEED_APPLICATIONS,
  SEED_PERMISSIONS,
  SEED_FEATURES,
  type SeedDef,
} from "./config.js";

interface SeedConfig {
  endpoint: string;
  projectId: string;
  apiKey: string;
}

function createDatabasesApi(config: SeedConfig): Databases {
  const client = new Client()
    .setEndpoint(config.endpoint)
    .setProject(config.projectId)
    .setKey(config.apiKey);
  return new Databases(client);
}

async function seedTable(
  databases: Databases,
  collectionId: string,
  seeds: SeedDef[],
): Promise<void> {
  for (const seed of seeds) {
    try {
      await databases.createDocument(
        DATABASE_ID,
        collectionId,
        seed.id,
        seed.data,
      );
      console.log(`[provisioning]   Seeded ${collectionId}/${seed.id}`);
    } catch (error: unknown) {
      const code = (error as { code?: number }).code;
      if (code === 409) {
        // Document already exists, skip
      } else {
        throw error;
      }
    }
  }
}

export async function seedData(config: SeedConfig): Promise<void> {
  const databases = createDatabasesApi(config);

  console.log("[provisioning] Seeding applications...");
  await seedTable(databases, "applications", SEED_APPLICATIONS);

  console.log("[provisioning] Seeding permissions...");
  await seedTable(databases, "permissions", SEED_PERMISSIONS);

  console.log("[provisioning] Seeding features...");
  await seedTable(databases, "features", SEED_FEATURES);

  console.log("[provisioning] Seeds complete.");
}
