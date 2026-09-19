import { Client, Databases } from "node-appwrite";
import { DATABASE_ID, DATABASE_NAME, TABLES, type TableDef } from "./config.js";

export interface DatabaseConfig {
  endpoint: string;
  projectId: string;
  apiKey: string;
}

function createDatabasesApi(config: DatabaseConfig): Databases {
  const client = new Client()
    .setEndpoint(config.endpoint)
    .setProject(config.projectId)
    .setKey(config.apiKey);
  return new Databases(client);
}

async function createAttribute(
  databases: Databases,
  tableId: string,
  attr: TableDef["attributes"][number],
): Promise<void> {
  const common = { databaseId: DATABASE_ID, collectionId: tableId, key: attr.key, required: attr.required };

  switch (attr.type) {
    case "string":
      await databases.createStringAttribute({ ...common, size: attr.size ?? 255 });
      break;
    case "integer":
      await databases.createIntegerAttribute(common);
      break;
    case "boolean":
      await databases.createBooleanAttribute(common);
      break;
    case "datetime":
      await databases.createDatetimeAttribute(common);
      break;
    case "enum":
      await databases.createEnumAttribute({ ...common, elements: attr.elements ?? [] });
      break;
  }
}

export async function createDatabase(config: DatabaseConfig): Promise<void> {
  const databases = createDatabasesApi(config);

  console.log("[provisioning] Creating database...");

  try {
    await databases.create({ databaseId: DATABASE_ID, name: DATABASE_NAME });
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
      await databases.createCollection({
        databaseId: DATABASE_ID,
        collectionId: table.id,
        name: table.name,
      });
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
