import { Client, Storage } from "node-appwrite";
import { STORAGE_BUCKETS } from "./config.js";
import type { DatabaseConfig } from "./database.js";

function createStorageApi(config: DatabaseConfig): Storage {
  const client = new Client()
    .setEndpoint(config.endpoint)
    .setProject(config.projectId)
    .setKey(config.apiKey);
  return new Storage(client);
}

export async function createBuckets(config: DatabaseConfig): Promise<void> {
  const storage = createStorageApi(config);

  for (const bucket of STORAGE_BUCKETS) {
    console.log(`[provisioning] Creating bucket: ${bucket.id}`);

    try {
      await storage.createBucket(
        bucket.id,
        bucket.name,
        [],
        true,
        true,
        bucket.maxSize,
        bucket.allowedFileExtensions,
      );
      console.log(`[provisioning] Bucket ${bucket.id} created.`);
    } catch (error: unknown) {
      const code = (error as { code?: number }).code;
      if (code === 409) {
        console.log(
          `[provisioning] Bucket ${bucket.id} already exists, skipping.`,
        );
      } else {
        throw error;
      }
    }
  }
}
