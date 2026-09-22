import { Storage } from "node-appwrite";
import { STORAGE_BUCKETS } from "./config.js";
import { createClient, type AppwriteConfig } from "./client.js";

function createStorageApi(config: AppwriteConfig): Storage {
  return new Storage(createClient(config));
}

export async function createBuckets(config: AppwriteConfig): Promise<void> {
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
        console.log(`[provisioning] Bucket ${bucket.id} already exists, skipping.`);
      } else {
        throw error;
      }
    }
  }
}
