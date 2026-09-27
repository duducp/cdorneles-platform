import { isApiError, type AccountApi, type FunctionsApi } from "@cdorneles/api-client";
import { MfaRequiredError } from "./errors";
import type { AuthService, AuthSession, AuthUser, MfaFactors, OneTapLoginInput } from "./types";

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

export function createAppwriteAuthService(
  accountApi: AccountApi,
  functionsApi?: FunctionsApi | null,
): AuthService {
  return {
    async login(input) {
      if (!functionsApi) {
        // The public-auth gate enforces Turnstile; without the functions
        // service there is no path to a session. Fail loudly.
        throw new Error("Public authentication is not available in this environment.");
      }
      try {
        const credentials = await functionsApi.publicLogin({
          email: input.email,
          password: input.password,
          turnstileToken: input.turnstileToken,
        });
        return mapSession(await accountApi.createSessionFromToken(credentials));
      } catch (error) {
        if (isApiError(error) && error.code === "user_more_factors_required") {
          throw new MfaRequiredError();
        }
        throw error;
      }
    },

    async loginWithOneTap(input: OneTapLoginInput) {
      if (!functionsApi) {
        // One Tap needs the one-tap-login function; without it the flow cannot
        // be honored and must fail loudly rather than pretend to succeed.
        throw new Error("Google One Tap is not available in this environment.");
      }
      try {
        // The function verifies the ID token server-side and refuses a token
        // for any account other than the one this client expects.
        const credentials = await functionsApi.oneTapLogin({
          idToken: input.idToken,
          expectedUserId: input.expectedUserId,
        });
        return mapSession(
          await accountApi.createSessionFromToken({
            userId: credentials.userId,
            secret: credentials.secret,
          }),
        );
      } catch (error) {
        if (isApiError(error) && error.code === "user_more_factors_required") {
          throw new MfaRequiredError();
        }
        throw error;
      }
    },

    async completeMfa(input) {
      if (!functionsApi) {
        throw new Error("Public authentication is not available in this environment.");
      }
      const session = await functionsApi.publicMfaVerify({
        challengeId: input.challengeId,
        otp: input.code,
        turnstileToken: input.turnstileToken,
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
      if (!functionsApi) {
        throw new Error("Public authentication is not available in this environment.");
      }
      const challenge = await functionsApi.publicMfaChallenge({
        factor: input.factor,
        turnstileToken: input.turnstileToken,
      });
      return { challengeId: challenge.challengeId, factor: input.factor };
    },

    async logout(sessionId) {
      await accountApi.deleteSession(sessionId);
    },

    async getSession() {
      try {
        const session = await accountApi.getCurrentSession();
        return mapSession(session);
      } catch (error) {
        if (isApiError(error) && error.code === "user_more_factors_required") {
          throw new MfaRequiredError();
        }
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
      try {
        const user = await accountApi.getCurrentUser();
        return mapUser(user);
      } catch (error) {
        if (isApiError(error) && error.code === "user_more_factors_required") {
          throw new MfaRequiredError();
        }
        throw error;
      }
    },

    async requestPasswordRecovery(input) {
      if (!functionsApi) {
        throw new Error("Public authentication is not available in this environment.");
      }
      await functionsApi.publicRequestRecovery({
        email: input.email,
        url: input.redirectUrl,
        turnstileToken: input.turnstileToken,
      });
    },

    async confirmPasswordRecovery(input) {
      if (!functionsApi) {
        throw new Error("Public authentication is not available in this environment.");
      }
      await functionsApi.publicCompleteRecovery({
        userId: input.userId,
        secret: input.secret,
        password: input.password,
        turnstileToken: input.turnstileToken,
      });
    },
  };
}
