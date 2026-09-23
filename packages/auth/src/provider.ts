import type { AuthService } from "./types";

/** Raised when an auth operation runs before a real provider is configured. */
export class AuthNotConfiguredError extends Error {
  constructor(operation: string) {
    super(`Authentication is not configured yet (attempted: ${operation}).`);
    this.name = "AuthNotConfiguredError";
  }
}

/**
 * Safe placeholder used by the Foundation so apps can mount without Appwrite
 * credentials. Every operation fails loudly instead of pretending to succeed.
 */
export function createUnconfiguredAuthService(): AuthService {
  const fail = (operation: string) => async (): Promise<never> => {
    throw new AuthNotConfiguredError(operation);
  };
  // Synchronous variant for the void-returning (redirect) operations.
  const failSync = (operation: string) => (): void => {
    throw new AuthNotConfiguredError(operation);
  };

  return {
    login: fail("login"),
    loginWithGoogle: failSync("loginWithGoogle"),
    loginWithOneTap: fail("loginWithOneTap"),
    completeMfa: fail("completeMfa"),
    listMfaFactors: fail("listMfaFactors"),
    createMfaChallenge: fail("createMfaChallenge"),
    logout: fail("logout"),
    getSession: fail("getSession"),
    renewSession: fail("renewSession"),
    getCurrentUser: fail("getCurrentUser"),
    requestPasswordRecovery: fail("requestPasswordRecovery"),
    confirmPasswordRecovery: fail("confirmPasswordRecovery"),
  };
}
