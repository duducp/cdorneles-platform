import { TablesDB } from "node-appwrite";
import { DATABASE_ID, DATABASE_NAME, TABLES, type TableDef } from "./config.js";
import { createClient, type AppwriteConfig } from "./client.js";

function createTablesDbApi(config: AppwriteConfig): TablesDB {
  return new TablesDB(createClient(config));
}

async function createColumn(
  tablesDb: TablesDB,
  tableId: string,
  attr: TableDef["attributes"][number],
): Promise<void> {
  switch (attr.type) {
    case "string":
      await tablesDb.createStringColumn(DATABASE_ID, tableId, attr.key, attr.size ?? 255, attr.required);
      break;
    case "integer":
      await tablesDb.createIntegerColumn(DATABASE_ID, tableId, attr.key, attr.required);
      break;
    case "boolean":
      await tablesDb.createBooleanColumn(DATABASE_ID, tableId, attr.key, attr.required);
      break;
    case "datetime":
      await tablesDb.createDatetimeColumn(DATABASE_ID, tableId, attr.key, attr.required);
      break;
    case "enum":
      await tablesDb.createEnumColumn(DATABASE_ID, tableId, attr.key, attr.elements ?? [], attr.required);
      break;
  }
}

export async function createDatabase(config: AppwriteConfig): Promise<void> {
  const tablesDb = createTablesDbApi(config);

  console.log("[provisioning] Creating database...");

  try {
    await tablesDb.create(DATABASE_ID, DATABASE_NAME);
    console.log("[provisioning] Database created.");
  } catch (error: unknown) {
    const code = (error as { code?: number }).code;
    if (code === 409) {
      console.log("[provisioning] Database already exists, skipping.");
    } else {
      throw error;
    }
  }

  for (const table of TABLES) {
    console.log(`[provisioning] Creating table: ${table.id}`);

    try {
      await tablesDb.createTable(DATABASE_ID, table.id, table.name);
      console.log(`[provisioning] Table ${table.id} created.`);
    } catch (error: unknown) {
      const code = (error as { code?: number }).code;
      if (code === 409) {
        console.log(`[provisioning] Table ${table.id} already exists, skipping.`);
      } else {
        throw error;
      }
    }

    for (const attr of table.attributes) {
      try {
        await createColumn(tablesDb, table.id, attr);
        console.log(`[provisioning]   + ${attr.key} (${attr.type})`);
      } catch (error: unknown) {
        const code = (error as { code?: number }).code;
        if (code === 409) {
          // Column already exists, skip
        } else {
          throw error;
        }
      }
    }
  }
}
