"use client";

import {
  describeAuthError,
  MfaRequiredError,
  useAuth,
} from "@cdorneles/auth";
import { SessionExpiredDialog, SessionExpiredMfaDialog } from "@cdorneles/ui";
import type { MfaChallengeFormValues } from "@cdorneles/ui";
import { useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useState } from "react";

const RENEWED_KEY = "cdorneles-session-renewed";

export function SessionExpiredGate() {
  const { sessionState, user, refresh, reauthenticate, completeReauthMfa, logout, service } =
    useAuth();
  const queryClient = useQueryClient();
  const [step, setStep] = useState<"password" | "mfa">("password");
  const [challengeId, setChallengeId] = useState<string | null>(null);

  const finish = useCallback(async () => {
    await queryClient.invalidateQueries();
    setStep("password");
    setChallengeId(null);
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

  const handleSignOut = useCallback(() => {
    void logout().finally(() => {
      window.location.href = "/login";
    });
  }, [logout]);

  if (sessionState !== "expired" || !user) {
    return null;
  }

  if (step === "mfa" && challengeId) {
    return <SessionExpiredMfaDialog onSubmit={handleMfa} onSignOut={handleSignOut} />;
  }

  return (
    <SessionExpiredDialog email={user.email} onSubmit={handlePassword} onSignOut={handleSignOut} />
  );
}
