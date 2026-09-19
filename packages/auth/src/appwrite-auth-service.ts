import type { AccountApi } from "@cdorneles/api-client";
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
      const session = await accountApi.createEmailPasswordSession(input);
      return mapSession(session);
    },

    async completeMfa() {
      throw new Error("MFA not implemented yet");
    },

    async logout(sessionId) {
      await accountApi.deleteSession(sessionId);
    },

    async getSession() {
      const sessions = await accountApi.listSessions();
      const current = sessions.find((s) => new Date(s.expire) > new Date());
      if (!current) return null;
      return mapSession(current);
    },

    async getCurrentUser() {
      const user = await accountApi.getCurrentUser();
      return mapUser(user);
    },

    async requestPasswordRecovery() {
      throw new Error("Password recovery not implemented yet");
    },

    async confirmPasswordRecovery() {
      throw new Error("Password recovery not implemented yet");
    },
  };
}
