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

export type MfaFactor = "totp" | "email" | "recovery";

export interface MfaChallenge {
  challengeId: string;
  factor: MfaFactor;
}

export interface LoginInput {
  email: string;
  password: string;
}

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

/**
 * Authentication service contract. MFA is part of the foundation because it is
 * a from-the-start requirement, not an optional extra.
 */
export interface AuthService {
  login(input: LoginInput): Promise<AuthSession>;
  completeMfa(input: CompleteMfaInput): Promise<AuthSession>;
  logout(sessionId?: string): Promise<void>;
  getSession(): Promise<AuthSession | null>;
  getCurrentUser(): Promise<AuthUser | null>;
  requestPasswordRecovery(input: PasswordRecoveryRequestInput): Promise<void>;
  confirmPasswordRecovery(input: PasswordRecoveryConfirmInput): Promise<void>;
}
