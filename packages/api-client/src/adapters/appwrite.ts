import type { ApiClient, AppwriteServices } from "../client";
import { createApiClient } from "../client";
import type { ApiClientConfig } from "../config";
import { createAccountApi } from "./account";
import { createAppwriteClient } from "./client";
import { createFunctionsApi } from "./functions";
import { createStorageApi } from "./storage";
import { createTablesApi } from "./tables";
import { createTeamsApi } from "./teams";

/** Builds the concrete Appwrite-backed services behind the api-client contracts. */
export function createAppwriteServices(config: ApiClientConfig): AppwriteServices {
  const client = createAppwriteClient(config);

  return {
    account: createAccountApi(client),
    teams: createTeamsApi(client),
    tables: createTablesApi(client),
    functions: createFunctionsApi(client),
    storage: createStorageApi(client),
  };
}

/** The ready-to-use client applications depend on. */
export function createAppwriteApiClient(config: ApiClientConfig): ApiClient {
  return createApiClient({ config, services: createAppwriteServices(config) });
}
