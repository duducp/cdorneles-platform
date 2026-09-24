/**
 * Authentication contracts (docs/authentication).
 *
 * Appwrite Authentication is the identity source of truth (ADR-003). These
 * types describe the domain boundary so applications never talk to the
 * Appwrite SDK directly. Concrete Appwrite wiring lands in a later step.
 */

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  emailVerified: boolean;
  mfaEnabled: boolean;
}

export interface AuthSession {
  id: string;
  userId: string;
  expiresAt: string;
}

export type MfaFactor = "totp" | "email";

export interface MfaChallenge {
  challengeId: string;
  factor: MfaFactor;
}

export interface LoginInput {
  email: string;
  password: string;
}

/**
 * The Google One Tap ID token (JWT) captured by the GSI callback, plus the
 * account the caller expects it to resolve to. The server refuses a token for
 * any other account, which stops a re-auth from silently swapping the user.
 */
export type OneTapLoginInput = { idToken: string; expectedUserId?: string };

export interface CompleteMfaInput {
  challengeId: string;
  code: string;
}

export interface PasswordRecoveryRequestInput {
  email: string;
  redirectUrl: string;
}

export interface PasswordRecoveryConfirmInput {
  userId: string;
  secret: string;
  password: string;
}

export interface MfaFactors {
  totp: boolean;
  phone: boolean;
  email: boolean;
  recoveryCode: boolean;
}

export interface CreateMfaChallengeInput {
  factor: "totp" | "email";
}

/**
 * Authentication service contract. MFA is part of the foundation because it is
 * a from-the-start requirement, not an optional extra.
 */
export interface AuthService {
  login(input: LoginInput): Promise<AuthSession>;
  /**
   * Signs in with a Google One Tap ID token: the one-tap-login function
   * verifies it server-side and the returned credentials establish the
   * session. Throws when the token is invalid or no user matches.
   */
  loginWithOneTap(input: OneTapLoginInput): Promise<AuthSession>;
  completeMfa(input: CompleteMfaInput): Promise<AuthSession>;
  listMfaFactors(): Promise<MfaFactors>;
  createMfaChallenge(input: CreateMfaChallengeInput): Promise<MfaChallenge>;
  logout(sessionId?: string): Promise<void>;
  getSession(): Promise<AuthSession | null>;
  /** Extends the current session. Requires a session that is still valid. */
  renewSession(): Promise<AuthSession>;
  getCurrentUser(): Promise<AuthUser | null>;
  requestPasswordRecovery(input: PasswordRecoveryRequestInput): Promise<void>;
  confirmPasswordRecovery(input: PasswordRecoveryConfirmInput): Promise<void>;
}
