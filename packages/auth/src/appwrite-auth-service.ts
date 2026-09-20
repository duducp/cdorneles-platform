import { isApiError, type AccountApi } from "@cdorneles/api-client";
import { MfaRequiredError } from "./errors";
import type { AuthService, AuthSession, AuthUser } from "./types";

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

    async completeMfa(input) {
      const session = await accountApi.updateMfaChallenge({
        challengeId: input.challengeId,
        otp: input.code,
      });
      return mapSession(session);
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
        passwordAgain: input.password,
      });
    },
  };
}
