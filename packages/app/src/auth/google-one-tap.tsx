"use client";

import { isApiError } from "@cdorneles/api-client";
import { useAuth } from "@cdorneles/auth";
import { forwardRef, useEffect, useImperativeHandle, useRef } from "react";

const GSI_SCRIPT_SRC = "https://accounts.google.com/gsi/client";

/** Small delay before asking Google to render the prompt, as GSI recommends. */
const PROMPT_DELAY_MS = 800;

interface GsiCredentialResponse {
  credential?: string;
}

/** The subset of GSI's prompt-moment notification this component reacts to. */
interface GsiPromptNotification {
  isNotDisplayed?: () => boolean;
  isSkippedMoment?: () => boolean;
}

interface GsiIdApi {
  initialize: (config: {
    client_id: string;
    callback: (response: GsiCredentialResponse) => void;
    auto_select?: boolean;
    cancel_on_tap_outside?: boolean;
    use_fedcm_for_prompt?: boolean;
  }) => void;
  prompt: (listener?: (notification: GsiPromptNotification) => void) => void;
}

declare global {
  interface Window {
    google?: { accounts: { id: GsiIdApi } };
  }
}

// Module-level singleton so React strict mode double-mounts (and any future
// second mount) never inject the GSI script twice.
let gsiScriptPromise: Promise<void> | null = null;

function loadGsiScript(): Promise<void> {
  if (typeof window === "undefined") return Promise.resolve();
  if (window.google?.accounts?.id) return Promise.resolve();
  if (gsiScriptPromise) return gsiScriptPromise;

  gsiScriptPromise = new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = GSI_SCRIPT_SRC;
    script.async = true;
    script.defer = true;
    script.onload = () => resolve();
    script.onerror = () => {
      // Allow a later retry instead of caching the failure forever.
      gsiScriptPromise = null;
      reject(new Error("failed to load the Google Identity Services script"));
    };
    document.head.appendChild(script);
  });
  return gsiScriptPromise;
}

/**
 * Maps a One Tap failure to something worth showing. Known causes from the
 * one-tap-login function get a specific message instead of a generic one.
 */
export function describeOneTapError(error: unknown): string {
  if (isApiError(error)) {
    switch (error.code) {
      case "unknown_email":
        return "Não há conta na plataforma para esta conta Google. Use e-mail e senha.";
      case "user_disabled":
        return "Conta bloqueada. Fale com um administrador.";
      case "email_not_verified":
        return "Confirme o e-mail da sua conta antes de entrar com o Google.";
      case "google_auth_disabled":
        return "O login com Google está desativado.";
      default:
        break;
    }
  }
  return "Não foi possível entrar com o Google. Tente novamente.";
}

/**
 * Reads the `email` claim out of a Google ID token for the UX-only check that
 * an unlock is happening for the same account. The signature is NOT verified
 * here — the one-tap-login function does that server-side.
 */
export function readIdTokenEmail(idToken: string): string | null {
  const payload = idToken.split(".")[1];
  if (!payload) return null;
  try {
    const normalized = payload.replace(/-/g, "+").replace(/_/g, "/");
    const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "=");
    const claims = JSON.parse(atob(padded)) as { email?: unknown };
    return typeof claims.email === "string" ? claims.email : null;
  } catch {
    return null;
  }
}

export interface GoogleOneTapHandle {
  /**
   * Re-opens the Google prompt. Calls `onUnavailable` when the prompt could
   * not be shown (SDK not ready, not displayed, or skipped) — never when the
   * user simply dismisses it.
   */
  prompt(onUnavailable?: () => void): void;
}

export interface GoogleOneTapProps {
  /** The OAuth client id Google issues for this origin. */
  clientId: string;
  /**
   * One Tap runs only while the visitor is confirmed anonymous — never while
   * the session is still being resolved and never for an authenticated user.
   */
  enabled: boolean;
  /** Called after the internal exchange established the Appwrite session. */
  onSuccess?: () => void;
  /** Receives the raw failure; the parent decides how to map or route it. */
  onError: (error: unknown) => void;
  /**
   * When set, the raw ID token is handed to the parent instead of being
   * exchanged here, so the parent owns the login policy.
   */
  onCredential?: (idToken: string) => void;
  /** Called as soon as a credential arrives, before any exchange. */
  onStart?: () => void;
}

/**
 * Google One Tap for the login screen.
 *
 * Loads the Google Identity Services SDK, initializes it with the platform's
 * client id and prompts the returning visitor to sign in with one tap. The
 * returned ID token (JWT) is exchanged for an Appwrite session by the
 * one-tap-login function (server-side verification), never trusted here.
 *
 * Renders nothing: Google draws the prompt itself. The classic
 * "Entrar com Google" button stays untouched as the fallback.
 */
export const GoogleOneTap = forwardRef<GoogleOneTapHandle, GoogleOneTapProps>(function GoogleOneTap(
  { clientId, enabled, onSuccess, onError, onCredential, onStart },
  ref,
) {
  const { loginWithOneTap } = useAuth();
  const idApiRef = useRef<GsiIdApi | null>(null);

  // Keep the latest callbacks/login in refs so the init effect stays stable
  // across renders instead of re-initializing GSI on every parent render.
  const onSuccessRef = useRef(onSuccess);
  const onErrorRef = useRef(onError);
  const onCredentialRef = useRef(onCredential);
  const onStartRef = useRef(onStart);
  const loginWithOneTapRef = useRef(loginWithOneTap);
  onSuccessRef.current = onSuccess;
  onErrorRef.current = onError;
  onCredentialRef.current = onCredential;
  onStartRef.current = onStart;
  loginWithOneTapRef.current = loginWithOneTap;

  useImperativeHandle(
    ref,
    () => ({
      prompt(onUnavailable) {
        const idApi = idApiRef.current;
        if (!idApi) {
          onUnavailable?.();
          return;
        }
        try {
          idApi.prompt((notification) => {
            if (notification.isNotDisplayed?.() || notification.isSkippedMoment?.()) {
              onUnavailable?.();
            }
          });
        } catch {
          onUnavailable?.();
        }
      },
    }),
    [],
  );

  useEffect(() => {
    if (!enabled || !clientId) return;

    let cancelled = false;
    let promptTimer: ReturnType<typeof setTimeout> | null = null;

    loadGsiScript()
      .then(() => {
        if (cancelled) return;
        const idApi = window.google?.accounts?.id;
        if (!idApi) return;
        idApiRef.current = idApi;

        idApi.initialize({
          client_id: clientId,
          callback: (response) => {
            const idToken = response?.credential;
            if (!idToken) return;
            onStartRef.current?.();
            if (onCredentialRef.current) {
              Promise.resolve()
                .then(() => onCredentialRef.current?.(idToken))
                .catch((error: unknown) => onErrorRef.current(error));
              return;
            }
            loginWithOneTapRef
              .current({ idToken })
              .then(() => onSuccessRef.current?.())
              .catch((error: unknown) => onErrorRef.current(error));
          },
          auto_select: false,
          cancel_on_tap_outside: true,
          use_fedcm_for_prompt: true,
        });

        promptTimer = setTimeout(() => {
          if (!cancelled) idApi.prompt();
        }, PROMPT_DELAY_MS);
      })
      .catch(() => {
        if (!cancelled) onErrorRef.current(null);
      });

    return () => {
      cancelled = true;
      idApiRef.current = null;
      if (promptTimer) clearTimeout(promptTimer);
    };
  }, [enabled, clientId]);

  return null;
});
