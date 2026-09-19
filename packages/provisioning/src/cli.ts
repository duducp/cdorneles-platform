import { existsSync } from "node:fs";
import { resolve } from "node:path";

import { resolveProvisioningEnv } from "./env.js";
import { runProvisioning } from "./index.js";

const envFile = resolve(import.meta.dirname, "../../../.env");
if (existsSync(envFile)) {
  process.loadEnvFile(envFile);
}

const config = resolveProvisioningEnv(process.env);

if (!config) {
  console.error(
    "[provisioning] Missing env vars. Set APPWRITE_API_KEY plus either " +
      "APPWRITE_ENDPOINT/APPWRITE_PROJECT_ID or " +
      "NEXT_PUBLIC_APPWRITE_ENDPOINT/NEXT_PUBLIC_APPWRITE_PROJECT_ID.",
  );
  process.exit(1);
}

try {
  await runProvisioning(config);
} catch (error) {
  console.error("[provisioning] Fatal error:", error);
  process.exit(1);
}
