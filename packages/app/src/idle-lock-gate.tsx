"use client";

import { describeAuthError, MfaRequiredError, useAuth } from "@cdorneles/auth";
import { LockScreen, SessionExpiredMfaDialog, type MfaChallengeFormValues } from "@cdorneles/ui";
import { Button, Modal, Text } from "@mantine/core";
import { useQueryClient } from "@tanstack/react-query";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { useIdleTimer } from "react-idle-timer";
import { isGoogleAuthEnabled } from "./auth/google-auth-enabled";
import {
  GoogleOneTap,
  describeOneTapError,
  readIdTokenEmail,
  type GoogleOneTapHandle,
} from "./auth/google-one-tap";

const DEFAULT_IDLE_TIMEOUT_MS = 15 * 60 * 1000;
const DEFAULT_PROMPT_BEFORE_IDLE_MS = 30 * 1000;
const MIN_TIMEOUT_MS = 60 * 1000;
const MAX_TIMEOUT_MS = 24 * 60 * 60 * 1000;

export interface IdleTimings {
  timeoutMs: number;
  promptBeforeIdleMs: number;
}

function toMs(value: string | undefined, unitMs: number, fallback: number): number {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? n * unitMs : fallback;
}

/**
 * Resolves the idle timings from the raw env values, falling back to the
 * defaults for anything missing or invalid. The timeout is bounded to
 * [1 min, 24 h] and the prompt is kept strictly below it, because
 * `react-idle-timer` throws unless `promptBeforeIdle < timeout`.
 */
export function resolveIdleTimings(
  timeoutMinutes: string | undefined,
  promptSeconds: string | undefined,
): IdleTimings {
  const rawTimeoutMs = toMs(timeoutMinutes, 60 * 1000, DEFAULT_IDLE_TIMEOUT_MS);
  const timeoutMs = Math.min(Math.max(rawTimeoutMs, MIN_TIMEOUT_MS), MAX_TIMEOUT_MS);
  const promptMs = toMs(promptSeconds, 1000, DEFAULT_PROMPT_BEFORE_IDLE_MS);
  const promptBeforeIdleMs = Math.min(promptMs, timeoutMs - 1000);
  return { timeoutMs, promptBeforeIdleMs };
}

const { timeoutMs: IDLE_TIMEOUT_MS, promptBeforeIdleMs: PROMPT_BEFORE_IDLE_MS } =
  resolveIdleTimings(
    process.env.NEXT_PUBLIC_IDLE_TIMEOUT_MINUTES,
    process.env.NEXT_PUBLIC_IDLE_PROMPT_SECONDS,
  );
/** Routes that must never lock (they have no session to protect). */
const PUBLIC_PREFIXES = ["/login", "/mfa", "/forgot-password", "/reset-password", "/select-org"];
const UNLOCKED_KEY = "cdorneles-idle-unlocked";

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
  const {
    status,
    sessionState,
    user,
    reauthenticate,
    completeReauthMfa,
    loginWithOneTap,
    logout,
    service,
  } = useAuth();
  const queryClient = useQueryClient();
  const pathname = usePathname();
  const [locked, setLocked] = useState(false);
  const [prompted, setPrompted] = useState(false);
  const [step, setStep] = useState<"password" | "mfa">("password");
  const [challengeId, setChallengeId] = useState<string | null>(null);
  const [googleMessage, setGoogleMessage] = useState<string | null>(null);
  const oneTapRef = useRef<GoogleOneTapHandle>(null);
  const googleClientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;
  const googleAvailable = isGoogleAuthEnabled() && !!googleClientId;

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
      setGoogleMessage(null);
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
      setGoogleMessage(null);
    }
  }, [sessionState]);

  // Another tab unlocked; drop the lock here too.
  useEffect(() => {
    const onStorage = (event: StorageEvent) => {
      if (event.key === UNLOCKED_KEY) {
        setLocked(false);
        setPrompted(false);
        setStep("password");
        setChallengeId(null);
        setGoogleMessage(null);
      }
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  const reset = useCallback(async () => {
    setLocked(false);
    setPrompted(false);
    setStep("password");
    setChallengeId(null);
    setGoogleMessage(null);
    window.localStorage.setItem(UNLOCKED_KEY, String(Date.now()));
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

  const handleGoogleCredential = useCallback(
    async (idToken: string) => {
      if (!user) return;
      const email = readIdTokenEmail(idToken);
      if (!email) {
        setGoogleMessage("Não foi possível entrar com o Google. Tente novamente.");
        return;
      }
      if (email.toLowerCase() !== user.email.toLowerCase()) {
        setGoogleMessage("Esta conta Google não corresponde à conta bloqueada.");
        return;
      }
      setGoogleMessage(null);
      try {
        await loginWithOneTap({ idToken });
        await reset();
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
    [user, loginWithOneTap, service, reset],
  );

  const handleSignOut = useCallback(() => {
    void logout().finally(() => {
      window.location.href = "/login";
    });
  }, [logout]);

  // The session-expired gate owns the dialog when the session is actually gone.
  if (!active || sessionState === "expired") return null;
  if (locked) {
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
          <LockScreen
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
  return prompted ? <IdlePrompt onContinue={() => activate()} /> : null;
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
