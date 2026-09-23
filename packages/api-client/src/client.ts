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
  updateSession(input: { sessionId: string }): Promise<AppwriteSession>;
  listSessions(): Promise<AppwriteSession[]>;
  createEmailPasswordSession(input: { email: string; password: string }): Promise<AppwriteSession>;
  /** Starts an OAuth2 sign-in: a full-page redirect to the provider. */
  createOAuth2Session(input: { provider: "google"; success: string; failure: string }): void;
  /**
   * Completes a server-orchestrated login: the `userId`+`secret` pair comes
   * from a trusted source (e.g. the one-tap-login function) and establishes
   * the browser session cookie.
   */
  createSessionFromToken(input: { userId: string; secret: string }): Promise<AppwriteSession>;
  deleteSession(sessionId?: string): Promise<void>;
  createRecovery(input: { email: string; url: string }): Promise<void>;
  updateRecovery(input: { userId: string; secret: string; password: string }): Promise<void>;
  listMfaFactors(): Promise<AppwriteMfaFactors>;
  createMfaChallenge(input: { factor: "totp" | "email" }): Promise<AppwriteMfaChallenge>;
  updateMfaChallenge(input: { challengeId: string; otp: string }): Promise<AppwriteSession>;
}

export interface TeamsApi {
  listTeams(): Promise<AppwriteTeam[]>;
  listMemberships(teamId: string): Promise<AppwriteMembership[]>;
  createTeam(input: { name: string; teamId?: string }): Promise<AppwriteTeam>;
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
    body?: string | Record<string, unknown>;
    path?: string;
    method?: string;
  }): Promise<AppwriteExecution>;
  createUser(input: {
    email: string;
    name: string;
    organizationId: string;
    role: string;
    permissions?: string[];
    labels?: string[];
  }): Promise<{ userId: string }>;
  updateUserPermissions(input: {
    userId: string;
    organizationId: string;
    permissions: string[];
  }): Promise<void>;
  listUsers(): Promise<{
    users: { id: string; email: string; name: string; labels: string[] }[];
  }>;
  listOrganizations(): Promise<{
    organizations: { id: string; name: string }[];
  }>;
  /**
   * Exchanges a Google One Tap ID token for Appwrite session credentials.
   * The one-tap-login function verifies the token server-side and returns the
   * `userId`+`secret` pair for `account.createSession`.
   */
  oneTapLogin(input: { idToken: string }): Promise<{ userId: string; secret: string }>;
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
  deleteFile(input: { bucketId: string; fileId: string }): Promise<void>;
  listFiles(input: { bucketId: string; queries?: string[] }): Promise<AppwriteFile[]>;
  getFileDownloadUrl(input: { bucketId: string; fileId: string }): string;
  getFileViewUrl(input: { bucketId: string; fileId: string }): string;
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
