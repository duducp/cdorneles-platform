import { Account } from "appwrite";
import type { Client } from "appwrite";

import type { AccountApi } from "../client";
import type { AppwriteAccount, AppwriteSession } from "../dto";
import { mapAppwriteError } from "./map-error";

export function createAccountApi(client: Client): AccountApi {
  const account = new Account(client);

  return {
    async getCurrentUser(): Promise<AppwriteAccount> {
      try {
        const user = await account.get();
        return { $id: user.$id, email: user.email, name: user.name, status: user.status };
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
        await account.deleteSession({ sessionId: sessionId ?? "current" });
      } catch (error) {
        throw mapAppwriteError(error);
      }
    },
  };
}
