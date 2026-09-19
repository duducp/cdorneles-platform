import { Storage } from "appwrite";
import type { Client, Models } from "appwrite";

import type { StorageApi } from "../client";
import { mapAppwriteError } from "./map-error";

function toAppwriteFile(file: Models.File) {
  return {
    $id: file.$id,
    $createdAt: file.$createdAt,
    $updatedAt: file.$updatedAt,
    bucketId: file.bucketId,
    name: file.name,
    mimeType: file.mimeType,
    sizeOriginal: file.sizeOriginal,
  };
}

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

    async uploadFile(input) {
      try {
        const file = await storage.createFile({
          bucketId: input.bucketId,
          fileId: input.fileId,
          file: input.file,
        });
        return toAppwriteFile(file);
      } catch (error) {
        throw mapAppwriteError(error);
      }
    },

    async deleteFile(input) {
      try {
        await storage.deleteFile({
          bucketId: input.bucketId,
          fileId: input.fileId,
        });
      } catch (error) {
        throw mapAppwriteError(error);
      }
    },

    async listFiles(input) {
      try {
        const result = await storage.listFiles({
          bucketId: input.bucketId,
          queries: input.queries,
        });
        return result.files.map((file) => toAppwriteFile(file));
      } catch (error) {
        throw mapAppwriteError(error);
      }
    },

    getFileDownloadUrl(input): string {
      try {
        return storage.getFileDownload({
          bucketId: input.bucketId,
          fileId: input.fileId,
        });
      } catch (error) {
        throw mapAppwriteError(error);
      }
    },

    getFileViewUrl(input): string {
      try {
        return storage.getFileView({
          bucketId: input.bucketId,
          fileId: input.fileId,
        });
      } catch (error) {
        throw mapAppwriteError(error);
      }
    },
  };
}
