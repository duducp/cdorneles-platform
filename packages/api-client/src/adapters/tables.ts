import { TablesDB } from "appwrite";
import type { Client } from "appwrite";

import type { TablesApi } from "../client";
import type { AppwriteRow } from "../dto";
import { mapAppwriteError } from "./map-error";

export function createTablesApi(client: Client): TablesApi {
  const tables = new TablesDB(client);

  return {
    async listRows(input): Promise<AppwriteRow[]> {
      try {
        const result = await tables.listRows({
          databaseId: input.databaseId,
          tableId: input.tableId,
          queries: input.queries,
        });
        return result.rows.map((row) => ({ ...row }));
      } catch (error) {
        throw mapAppwriteError(error);
      }
    },

    async getRow(input): Promise<AppwriteRow> {
      try {
        const row = await tables.getRow({
          databaseId: input.databaseId,
          tableId: input.tableId,
          rowId: input.rowId,
        });
        return { ...row };
      } catch (error) {
        throw mapAppwriteError(error);
      }
    },
  };
}
