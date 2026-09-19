import { Client } from "appwrite";

import type { ApiClientConfig } from "../config";

/**
 * Creates the single Appwrite Web SDK client used by every service adapter.
 * Called from `createAppwriteServices`, never at module top level, so importing
 * the package has no side effects.
 */
export function createAppwriteClient(config: ApiClientConfig): Client {
  return new Client().setEndpoint(config.endpoint).setProject(config.projectId);
}
