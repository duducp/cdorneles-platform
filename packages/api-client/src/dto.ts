/**
 * Transport DTOs.
 *
 * These are structural projections of Appwrite resources, used only at the
 * api-client boundary. They are NOT stored entities and do not duplicate
 * Appwrite Users/Teams (ADR-004); the domain packages map them to their own
 * models.
 */

export interface AppwriteAccount {
  $id: string;
  email: string;
  name: string;
  status: boolean;
}

export interface AppwriteSession {
  $id: string;
  userId: string;
  expire: string;
}

export interface AppwriteTeam {
  $id: string;
  name: string;
}

export interface AppwriteMembership {
  $id: string;
  teamId: string;
  userId: string;
  roles: string[];
}

export interface AppwriteDocument {
  $id: string;
  $createdAt: string;
  $updatedAt: string;
  [key: string]: unknown;
}

export interface AppwriteExecution {
  $id: string;
  status: string;
  responseBody: string;
}
