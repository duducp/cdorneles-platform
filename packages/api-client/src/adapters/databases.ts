import { Databases } from "appwrite";
import type { Client } from "appwrite";

import type { DatabasesApi } from "../client";
import type { AppwriteDocument } from "../dto";
import { mapAppwriteError } from "./map-error";

export function createDatabasesApi(client: Client): DatabasesApi {
  const databases = new Databases(client);

  return {
    async listDocuments(input): Promise<AppwriteDocument[]> {
      try {
        const result = await databases.listDocuments(
          input.databaseId,
          input.collectionId,
          input.queries,
        );
        return result.documents.map((document) => ({ ...document }));
      } catch (error) {
        throw mapAppwriteError(error);
      }
    },

    async getDocument(input): Promise<AppwriteDocument> {
      try {
        const document = await databases.getDocument(
          input.databaseId,
          input.collectionId,
          input.documentId,
        );
        return { ...document };
      } catch (error) {
        throw mapAppwriteError(error);
      }
    },
  };
}
