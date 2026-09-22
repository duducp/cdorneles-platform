"use client";

import { describeAuthError, MfaRequiredError, useAuth } from "@cdorneles/auth";
import { LockScreen, SessionExpiredMfaDialog, type MfaChallengeFormValues } from "@cdorneles/ui";
import { Button, Modal, Text } from "@mantine/core";
import { useQueryClient } from "@tanstack/react-query";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { useIdleTimer } from "react-idle-timer";

/** Total inactivity before the lock (ms). */
const IDLE_TIMEOUT_MS = 15 * 60 * 1000;
/** How long before the lock the warning appears (ms). */
const PROMPT_BEFORE_IDLE_MS = 30 * 1000;
/** Routes that must never lock (they have no session to protect). */
const PUBLIC_PREFIXES = ["/login", "/mfa", "/forgot-password", "/reset-password", "/select-org"];

/**
 * Locks the screen after inactivity and asks for the password to continue.
 *
 * This is a UX control, not a security boundary (AGENTS.md): it deters a
 * walk-away or a shoulder-surfer. The real control is the Appwrite session
 * duration. Unlocking always re-authenticates, even if the session is still
 * valid, because that is what the user asked for.
 *
 * The lock is an overlay: it renders alongside the page, never instead of it,
 * so unsaved work survives.
 */
export function IdleLockGate() {
  const { status, sessionState, user, reauthenticate, completeReauthMfa, logout, service } = useAuth();
  const queryClient = useQueryClient();
  const pathname = usePathname();
  const [locked, setLocked] = useState(false);
  const [prompted, setPrompted] = useState(false);
  const [step, setStep] = useState<"password" | "mfa">("password");
  const [challengeId, setChallengeId] = useState<string | null>(null);

  const active =
    status === "authenticated" &&
    !!user &&
    !PUBLIC_PREFIXES.some((prefix) => pathname.startsWith(prefix));

  const { activate } = useIdleTimer({
    timeout: IDLE_TIMEOUT_MS,
    promptBeforeIdle: PROMPT_BEFORE_IDLE_MS,
    crossTab: true,
    disabled: !active,
    onPrompt: () => setPrompted(true),
    onActive: () => setPrompted(false),
    onIdle: () => {
      setPrompted(false);
      setLocked(true);
    },
  });

  // When the session actually expires, the session-expired gate owns the dialog.
  // Drop our own lock so it does not reappear after a successful reauth.
  useEffect(() => {
    if (sessionState === "expired") {
      setLocked(false);
      setPrompted(false);
      setStep("password");
      setChallengeId(null);
    }
  }, [sessionState]);

  const reset = useCallback(async () => {
    setLocked(false);
    setPrompted(false);
    setStep("password");
    setChallengeId(null);
    await queryClient.invalidateQueries();
  }, [queryClient]);

  const handlePassword = useCallback(
    async (password: string) => {
      if (!user) return;
      try {
        await reauthenticate({ email: user.email, password });
        await reset();
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
    [user, reauthenticate, service, reset],
  );

  const handleMfa = useCallback(
    async (values: MfaChallengeFormValues) => {
      if (!challengeId) return;
      await completeReauthMfa({ challengeId, code: values.code });
      await reset();
    },
    [challengeId, completeReauthMfa, reset],
  );

  const handleSignOut = useCallback(() => {
    void logout().finally(() => {
      window.location.href = "/login";
    });
  }, [logout]);

  // The session-expired gate owns the dialog when the session is actually gone.
  if (!active || sessionState === "expired") return null;
  if (locked) {
    if (step === "mfa" && challengeId) {
      return <SessionExpiredMfaDialog onSubmit={handleMfa} onSignOut={handleSignOut} />;
    }
    return <LockScreen email={user.email} onSubmit={handlePassword} onSignOut={handleSignOut} />;
  }
  return prompted ? <IdlePrompt onContinue={activate} /> : null;
}

function IdlePrompt({ onContinue }: { onContinue: () => void }) {
  const [seconds, setSeconds] = useState(Math.round(PROMPT_BEFORE_IDLE_MS / 1000));

  useEffect(() => {
    const id = setInterval(() => setSeconds((value) => Math.max(0, value - 1)), 1000);
    return () => clearInterval(id);
  }, []);

  return (
    <Modal
      opened
      onClose={() => {}}
      withCloseButton={false}
      closeOnClickOutside={false}
      closeOnEscape={false}
      centered
      title="Ainda está aí?"
    >
      <Text fz="sm" c="dimmed" mb="md">
        Sua tela será bloqueada em {seconds}s por inatividade.
      </Text>
      <Button fullWidth onClick={onContinue}>
        Continuar trabalhando
      </Button>
    </Modal>
  );
}
