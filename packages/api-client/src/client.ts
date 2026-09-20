import type { ApiClientConfig } from "./config";
import type {
  AppwriteAccount,
  AppwriteExecution,
  AppwriteFile,
  AppwriteMembership,
  AppwriteMfaChallenge,
  AppwriteMfaFactors,
  AppwriteRow,
  AppwriteSession,
  AppwriteTeam,
} from "./dto";

export interface AccountApi {
  getCurrentUser(): Promise<AppwriteAccount>;
  getCurrentSession(): Promise<AppwriteSession>;
  listSessions(): Promise<AppwriteSession[]>;
  createEmailPasswordSession(input: { email: string; password: string }): Promise<AppwriteSession>;
  deleteSession(sessionId?: string): Promise<void>;
  createRecovery(input: { email: string; url: string }): Promise<void>;
  updateRecovery(input: {
    userId: string;
    secret: string;
    password: string;
  }): Promise<void>;
  listMfaFactors(): Promise<AppwriteMfaFactors>;
  createMfaChallenge(input: { factor: "totp" | "email" }): Promise<AppwriteMfaChallenge>;
  updateMfaChallenge(input: { challengeId: string; otp: string }): Promise<AppwriteSession>;
}

export interface TeamsApi {
  listTeams(): Promise<AppwriteTeam[]>;
  listMemberships(teamId: string): Promise<AppwriteMembership[]>;
}

export interface TablesApi {
  listRows(input: {
    databaseId: string;
    tableId: string;
    queries?: string[];
  }): Promise<AppwriteRow[]>;
  getRow(input: { databaseId: string; tableId: string; rowId: string }): Promise<AppwriteRow>;
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
  uploadFile(input: {
    bucketId: string;
    fileId: string;
    file: File;
    permissions?: string[];
  }): Promise<AppwriteFile>;
  deleteFile(input: {
    bucketId: string;
    fileId: string;
  }): Promise<void>;
  listFiles(input: {
    bucketId: string;
    queries?: string[];
  }): Promise<AppwriteFile[]>;
  getFileDownloadUrl(input: {
    bucketId: string;
    fileId: string;
  }): string;
  getFileViewUrl(input: {
    bucketId: string;
    fileId: string;
  }): string;
}

/** Concrete Appwrite-backed services. Built by `createAppwriteServices`. */
export interface AppwriteServices {
  account: AccountApi;
  teams: TeamsApi;
  tables: TablesApi;
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
 * Wires a validated configuration to a set of concrete services. Use
 * `createAppwriteApiClient` for the Appwrite-backed implementation.
 */
export function createApiClient(options: CreateApiClientOptions): ApiClient {
  return {
    config: options.config,
    ...options.services,
  };
}
