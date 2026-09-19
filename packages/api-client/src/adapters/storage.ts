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
          storage.getFilePreview(
            input.bucketId,
            input.fileId,
            input.width ?? 0,
            input.height ?? 0,
          ),
        );
      } catch (error) {
        throw handleError(error);
      }
    },

    async uploadFile(input) {
      try {
        const result = await storage.createFile(input.bucketId, input.fileId, input.file);
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
        await storage.deleteFile(input.bucketId, input.fileId);
      } catch (error) {
        throw handleError(error);
      }
    },

    async listFiles(input) {
      try {
        const result = await storage.listFiles(input.bucketId, input.queries);
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
        return resolveUrl(storage.getFileDownload(input.bucketId, input.fileId));
      } catch (error) {
        throw handleError(error);
      }
    },

    getFileViewUrl(input) {
      try {
        return resolveUrl(storage.getFileView(input.bucketId, input.fileId));
      } catch (error) {
        throw handleError(error);
      }
    },
  };
}
