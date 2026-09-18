import type { ApiClientConfig } from "./config";
import type {
  AppwriteAccount,
  AppwriteDocument,
  AppwriteExecution,
  AppwriteMembership,
  AppwriteSession,
  AppwriteTeam,
} from "./dto";

export interface AccountApi {
  getCurrentUser(): Promise<AppwriteAccount>;
  listSessions(): Promise<AppwriteSession[]>;
  createEmailPasswordSession(input: { email: string; password: string }): Promise<AppwriteSession>;
  deleteSession(sessionId?: string): Promise<void>;
}

export interface TeamsApi {
  listTeams(): Promise<AppwriteTeam[]>;
  listMemberships(teamId: string): Promise<AppwriteMembership[]>;
}

export interface DatabasesApi {
  listDocuments(input: {
    databaseId: string;
    collectionId: string;
    queries?: string[];
  }): Promise<AppwriteDocument[]>;
  getDocument(input: {
    databaseId: string;
    collectionId: string;
    documentId: string;
  }): Promise<AppwriteDocument>;
}

export interface FunctionsApi {
  createExecution(input: {
    functionId: string;
    body?: string;
    path?: string;
    method?: string;
  }): Promise<AppwriteExecution>;
}

export interface StorageApi {
  getFilePreviewUrl(input: {
    bucketId: string;
    fileId: string;
    width?: number;
    height?: number;
  }): string;
}

/** Concrete Appwrite-backed services. Implemented in a later step. */
export interface AppwriteServices {
  account: AccountApi;
  teams: TeamsApi;
  databases: DatabasesApi;
  functions: FunctionsApi;
  storage: StorageApi;
}

/**
 * The single abstraction applications use to reach Appwrite (ARCHITECTURE §4).
 * Application code must not instantiate Appwrite SDK clients directly.
 */
export interface ApiClient extends AppwriteServices {
  readonly config: ApiClientConfig;
}

export interface CreateApiClientOptions {
  config: ApiClientConfig;
  services: AppwriteServices;
}

/**
 * Wires a validated configuration to the concrete Appwrite services. The
 * concrete SDK adapter is intentionally not part of the Foundation.
 */
export function createApiClient(options: CreateApiClientOptions): ApiClient {
  return {
    config: options.config,
    ...options.services,
  };
}
