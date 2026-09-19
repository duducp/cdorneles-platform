import { Storage } from "appwrite";
import type { Client } from "appwrite";

import type { StorageApi } from "../client";
import { mapAppwriteError } from "./map-error";

export function createStorageApi(client: Client): StorageApi {
  const storage = new Storage(client);

  return {
    getFilePreviewUrl(input): string {
      try {
        return storage.getFilePreview({
          bucketId: input.bucketId,
          fileId: input.fileId,
          width: input.width,
          height: input.height,
        });
      } catch (error) {
        throw mapAppwriteError(error);
      }
    },
  };
}
