import { Storage as AppwriteStorage } from "appwrite";
import type { Client } from "appwrite";

import type { StorageApi } from "../client";
import type { ApiError } from "../errors";
import { mapAppwriteError } from "./map-error";

function createStorage(client: Client): AppwriteStorage {
  return new AppwriteStorage(client);
}

function handleError(error: unknown): ApiError {
  return mapAppwriteError(error);
}

/** The SDK declares `string`, but some versions return a `URL` object. */
function resolveUrl(url: string | URL): string {
  return typeof url === "string" ? url : url.href;
}

export function createStorageApi(client: Client): StorageApi {
  const storage = createStorage(client);

  return {
    getFilePreviewUrl(input) {
      try {
        return resolveUrl(
          storage.getFilePreview({
            bucketId: input.bucketId,
            fileId: input.fileId,
            width: input.width,
            height: input.height,
          }),
        );
      } catch (error) {
        throw handleError(error);
      }
    },

    async uploadFile(input) {
      try {
        const result = await storage.createFile({
          bucketId: input.bucketId,
          fileId: input.fileId,
          file: input.file,
        });
        return {
          $id: result.$id,
          $createdAt: result.$createdAt,
          $updatedAt: result.$updatedAt,
          bucketId: result.bucketId,
          name: result.name,
          mimeType: result.mimeType,
          sizeOriginal: result.sizeOriginal,
        };
      } catch (error) {
        throw handleError(error);
      }
    },

    async deleteFile(input) {
      try {
        await storage.deleteFile({ bucketId: input.bucketId, fileId: input.fileId });
      } catch (error) {
        throw handleError(error);
      }
    },

    async listFiles(input) {
      try {
        const result = await storage.listFiles({
          bucketId: input.bucketId,
          queries: input.queries,
        });
        return result.files.map((file) => ({
          $id: file.$id,
          $createdAt: file.$createdAt,
          $updatedAt: file.$updatedAt,
          bucketId: file.bucketId,
          name: file.name,
          mimeType: file.mimeType,
          sizeOriginal: file.sizeOriginal,
        }));
      } catch (error) {
        throw handleError(error);
      }
    },

    getFileDownloadUrl(input) {
      try {
        return resolveUrl(
          storage.getFileDownload({ bucketId: input.bucketId, fileId: input.fileId }),
        );
      } catch (error) {
        throw handleError(error);
      }
    },

    getFileViewUrl(input) {
      try {
        return resolveUrl(storage.getFileView({ bucketId: input.bucketId, fileId: input.fileId }));
      } catch (error) {
        throw handleError(error);
      }
    },
  };
}
