import { isApiError, type AccountApi } from "@cdorneles/api-client";
import { MfaRequiredError } from "./errors";
import type { AuthService, AuthSession, AuthUser, MfaFactors } from "./types";

function mapSession(raw: { $id: string; userId: string; expire: string }): AuthSession {
  return { id: raw.$id, userId: raw.userId, expiresAt: raw.expire };
}

function mapUser(raw: {
  $id: string;
  email: string;
  name: string;
  emailVerification: boolean;
  mfa: boolean;
}): AuthUser {
  return {
    id: raw.$id,
    email: raw.email,
    name: raw.name,
    emailVerified: raw.emailVerification,
    mfaEnabled: raw.mfa,
  };
}

export function createAppwriteAuthService(accountApi: AccountApi): AuthService {
  return {
    async login(input) {
      try {
        const session = await accountApi.createEmailPasswordSession(input);
        return mapSession(session);
      } catch (error) {
        if (isApiError(error) && error.code === "user_more_factors_required") {
          throw new MfaRequiredError();
        }
        throw error;
      }
    },

    loginWithGoogle(input) {
      accountApi.createOAuth2Session({
        provider: "google",
        success: input.successUrl,
        failure: input.failureUrl,
      });
    },

    async completeMfa(input) {
      const session = await accountApi.updateMfaChallenge({
        challengeId: input.challengeId,
        otp: input.code,
      });
      return mapSession(session);
    },

    async listMfaFactors(): Promise<MfaFactors> {
      const factors = await accountApi.listMfaFactors();
      return {
        totp: factors.totp,
        phone: factors.phone,
        email: factors.email,
        recoveryCode: factors.recoveryCode,
      };
    },

    async createMfaChallenge(input) {
      const challenge = await accountApi.createMfaChallenge({ factor: input.factor });
      return { challengeId: challenge.$id, factor: input.factor };
    },

    async logout(sessionId) {
      await accountApi.deleteSession(sessionId);
    },

    async getSession() {
      try {
        const session = await accountApi.getCurrentSession();
        return mapSession(session);
      } catch (error) {
        if (isApiError(error) && error.status === 401) {
          return null;
        }
        throw error;
      }
    },

    async renewSession() {
      const session = await accountApi.updateSession({ sessionId: "current" });
      return mapSession(session);
    },

    async getCurrentUser() {
      const user = await accountApi.getCurrentUser();
      return mapUser(user);
    },

    async requestPasswordRecovery(input) {
      await accountApi.createRecovery({ email: input.email, url: input.redirectUrl });
    },

    async confirmPasswordRecovery(input) {
      await accountApi.updateRecovery({
        userId: input.userId,
        secret: input.secret,
        password: input.password,
      });
    },
  };
}
