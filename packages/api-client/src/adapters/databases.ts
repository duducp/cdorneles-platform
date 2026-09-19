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
        const result = await databases.listDocuments({
          databaseId: input.databaseId,
          collectionId: input.collectionId,
          queries: input.queries,
        });
        return result.documents.map((document) => ({ ...document }));
      } catch (error) {
        throw mapAppwriteError(error);
      }
    },

    async getDocument(input): Promise<AppwriteDocument> {
      try {
        const document = await databases.getDocument({
          databaseId: input.databaseId,
          collectionId: input.collectionId,
          documentId: input.documentId,
        });
        return { ...document };
      } catch (error) {
        throw mapAppwriteError(error);
      }
    },
  };
}
