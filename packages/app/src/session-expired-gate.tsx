"use client";

import { describeAuthError, MfaRequiredError, useAuth } from "@cdorneles/auth";
import { SessionExpiredDialog, SessionExpiredMfaDialog } from "@cdorneles/ui";
import type { MfaChallengeFormValues } from "@cdorneles/ui";
import { useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  GoogleOneTap,
  describeOneTapError,
  readIdTokenEmail,
  type GoogleOneTapHandle,
} from "./auth/google-one-tap";
import { isGoogleAuthEnabled } from "./auth/google-auth-enabled";

const RENEWED_KEY = "cdorneles-session-renewed";

export function SessionExpiredGate() {
  const {
    sessionState,
    user,
    refresh,
    reauthenticate,
    completeReauthMfa,
    loginWithOneTap,
    logout,
    service,
  } = useAuth();
  const queryClient = useQueryClient();
  const [step, setStep] = useState<"password" | "mfa">("password");
  const [challengeId, setChallengeId] = useState<string | null>(null);
  const [googleMessage, setGoogleMessage] = useState<string | null>(null);
  const oneTapRef = useRef<GoogleOneTapHandle>(null);
  const googleClientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;
  const googleAvailable = isGoogleAuthEnabled() && !!googleClientId;

  const finish = useCallback(async () => {
    await queryClient.invalidateQueries();
    setStep("password");
    setChallengeId(null);
    setGoogleMessage(null);
  }, [queryClient]);

  useEffect(() => {
    const onStorage = (event: StorageEvent) => {
      if (event.key === RENEWED_KEY) {
        void refresh();
      }
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, [refresh]);

  const handlePassword = useCallback(
    async (password: string) => {
      if (!user) return;
      try {
        await reauthenticate({ email: user.email, password });
        await finish();
        window.localStorage.setItem(RENEWED_KEY, String(Date.now()));
      } catch (error) {
        if (error instanceof MfaRequiredError) {
          const challenge = await service.createMfaChallenge({ factor: "totp" });
          setChallengeId(challenge.challengeId);
          setStep("mfa");
          return;
        }
        throw new Error(describeAuthError(error), { cause: error });
      }
    },
    [user, reauthenticate, service, finish],
  );

  const handleMfa = useCallback(
    async (values: MfaChallengeFormValues) => {
      if (!challengeId) return;
      await completeReauthMfa({ challengeId, code: values.code });
      await finish();
      window.localStorage.setItem(RENEWED_KEY, String(Date.now()));
    },
    [challengeId, completeReauthMfa, finish],
  );

  const handleGoogleCredential = useCallback(
    async (idToken: string) => {
      if (!user) return;
      const email = readIdTokenEmail(idToken);
      if (!email) {
        setGoogleMessage("Não foi possível entrar com o Google. Tente novamente.");
        return;
      }
      if (email.toLowerCase() !== user.email.toLowerCase()) {
        setGoogleMessage("Esta conta Google não corresponde à sua conta.");
        return;
      }
      setGoogleMessage(null);
      try {
        await loginWithOneTap({ idToken });
        await finish();
        window.localStorage.setItem(RENEWED_KEY, String(Date.now()));
      } catch (error) {
        if (error instanceof MfaRequiredError) {
          const challenge = await service.createMfaChallenge({ factor: "totp" });
          setChallengeId(challenge.challengeId);
          setStep("mfa");
          return;
        }
        setGoogleMessage(describeAuthError(error));
      }
    },
    [user, loginWithOneTap, service, finish],
  );

  const handleSignOut = useCallback(() => {
    void logout().finally(() => {
      window.location.href = "/login";
    });
  }, [logout]);

  if (sessionState !== "expired" || !user) {
    return null;
  }

  return (
    <>
      {googleAvailable && step === "password" ? (
        <GoogleOneTap
          ref={oneTapRef}
          clientId={googleClientId ?? ""}
          enabled
          onCredential={handleGoogleCredential}
          onError={(error) => setGoogleMessage(describeOneTapError(error))}
        />
      ) : null}
      {step === "mfa" && challengeId ? (
        <SessionExpiredMfaDialog onSubmit={handleMfa} onSignOut={handleSignOut} />
      ) : (
        <SessionExpiredDialog
          email={user.email}
          onSubmit={handlePassword}
          onSignOut={handleSignOut}
          errorMessage={googleMessage}
          google={
            googleAvailable
              ? {
                  onClick: () =>
                    oneTapRef.current?.prompt(() =>
                      setGoogleMessage("Não foi possível abrir o Google. Use sua senha."),
                    ),
                }
              : undefined
          }
        />
      )}
    </>
  );
}
