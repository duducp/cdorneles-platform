import { runProvisioning } from "./index.js";

const endpoint = process.env.APPWRITE_ENDPOINT;
const projectId = process.env.APPWRITE_PROJECT_ID;
const apiKey = process.env.APPWRITE_API_KEY;

if (!endpoint || !projectId || !apiKey) {
  console.error("[provisioning] Missing required env vars: APPWRITE_ENDPOINT, APPWRITE_PROJECT_ID, APPWRITE_API_KEY");
  process.exit(1);
}

try {
  await runProvisioning({ endpoint, projectId, apiKey });
} catch (error) {
  console.error("[provisioning] Fatal error:", error);
  process.exit(1);
}
