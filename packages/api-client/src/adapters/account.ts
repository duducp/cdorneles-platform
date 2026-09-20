import { Account } from "appwrite";
import type { Client } from "appwrite";

import type { AccountApi } from "../client";
import type { AppwriteAccount, AppwriteMfaChallenge, AppwriteMfaFactors, AppwriteSession } from "../dto";
import { mapAppwriteError } from "./map-error";

export function createAccountApi(client: Client): AccountApi {
  const account = new Account(client);

  return {
    async getCurrentUser(): Promise<AppwriteAccount> {
      try {
        const user = await account.get();
        return {
          $id: user.$id,
          email: user.email,
          name: user.name,
          status: user.status,
          emailVerification: user.emailVerification,
          mfa: user.mfa,
        };
      } catch (error) {
        throw mapAppwriteError(error);
      }
    },

    async getCurrentSession(): Promise<AppwriteSession> {
      try {
        const session = await account.getSession({ sessionId: "current" });
        return { $id: session.$id, userId: session.userId, expire: session.expire };
      } catch (error) {
        throw mapAppwriteError(error);
      }
    },

    async listSessions(): Promise<AppwriteSession[]> {
      try {
        const result = await account.listSessions();
        return result.sessions.map((session) => ({
          $id: session.$id,
          userId: session.userId,
          expire: session.expire,
        }));
      } catch (error) {
        throw mapAppwriteError(error);
      }
    },

    async createEmailPasswordSession(input): Promise<AppwriteSession> {
      try {
        const session = await account.createEmailPasswordSession({
          email: input.email,
          password: input.password,
        });
        return { $id: session.$id, userId: session.userId, expire: session.expire };
      } catch (error) {
        throw mapAppwriteError(error);
      }
    },

    async deleteSession(sessionId): Promise<void> {
      try {
        await account.deleteSession({ sessionId: sessionId || "current" });
      } catch (error) {
        throw mapAppwriteError(error);
      }
    },

    async createRecovery(input): Promise<void> {
      try {
        await account.createRecovery({ email: input.email, url: input.url });
      } catch (error) {
        throw mapAppwriteError(error);
      }
    },

    async updateRecovery(input): Promise<void> {
      try {
        await account.updateRecovery({
          userId: input.userId,
          secret: input.secret,
          password: input.password,
          passwordAgain: input.passwordAgain,
        });
      } catch (error) {
        throw mapAppwriteError(error);
      }
    },

    async listMfaFactors(): Promise<AppwriteMfaFactors> {
      try {
        const factors = await account.listMfaFactors();
        return {
          totp: factors.totp,
          phone: factors.phone,
          email: factors.email,
          recoveryCode: factors.recoveryCode,
        };
      } catch (error) {
        throw mapAppwriteError(error);
      }
    },

    async createMfaChallenge(input): Promise<AppwriteMfaChallenge> {
      try {
        const challenge = await account.createMfaChallenge({ factor: input.factor });
        return { $id: challenge.$id, factor: input.factor };
      } catch (error) {
        throw mapAppwriteError(error);
      }
    },

    async updateMfaChallenge(input): Promise<AppwriteSession> {
      try {
        const session = await account.updateMfaChallenge({
          challengeId: input.challengeId,
          otp: input.otp,
        });
        return { $id: session.$id, userId: session.userId, expire: session.expire };
      } catch (error) {
        throw mapAppwriteError(error);
      }
    },
  };
}
