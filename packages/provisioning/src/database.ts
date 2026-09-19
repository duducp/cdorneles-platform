import { Databases } from "node-appwrite";
import { DATABASE_ID, DATABASE_NAME, TABLES, type TableDef } from "./config.js";
import { createClient, type AppwriteConfig } from "./client.js";

function createDatabasesApi(config: AppwriteConfig): Databases {
  return new Databases(createClient(config));
}

async function createAttribute(
  databases: Databases,
  tableId: string,
  attr: TableDef["attributes"][number],
): Promise<void> {
  switch (attr.type) {
    case "string":
      await databases.createStringAttribute(DATABASE_ID, tableId, attr.key, attr.size ?? 255, attr.required);
      break;
    case "integer":
      await databases.createIntegerAttribute(DATABASE_ID, tableId, attr.key, attr.required);
      break;
    case "boolean":
      await databases.createBooleanAttribute(DATABASE_ID, tableId, attr.key, attr.required);
      break;
    case "datetime":
      await databases.createDatetimeAttribute(DATABASE_ID, tableId, attr.key, attr.required);
      break;
    case "enum":
      await databases.createEnumAttribute(DATABASE_ID, tableId, attr.key, attr.elements ?? [], attr.required);
      break;
  }
}

export async function createDatabase(config: AppwriteConfig): Promise<void> {
  const databases = createDatabasesApi(config);

  console.log("[provisioning] Creating database...");

  try {
    await databases.create(DATABASE_ID, DATABASE_NAME);
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
      await databases.createCollection(
        DATABASE_ID,
        table.id,
        table.name,
      );
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
        await createAttribute(databases, table.id, attr);
        console.log(`[provisioning]   + ${attr.key} (${attr.type})`);
      } catch (error: unknown) {
        const code = (error as { code?: number }).code;
        if (code === 409) {
          // Attribute already exists, skip
        } else {
          throw error;
        }
      }
    }
  }
}
