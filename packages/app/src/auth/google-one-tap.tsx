"use client";

import { isApiError } from "@cdorneles/api-client";
import { useAuth } from "@cdorneles/auth";
import { useAppColorScheme } from "@cdorneles/theme";
import { type RefObject, useCallback, useEffect, useRef } from "react";

const GSI_SCRIPT_SRC = "https://accounts.google.com/gsi/client";

/** Small delay before asking Google to render the prompt, as GSI recommends. */
const PROMPT_DELAY_MS = 800;

interface GsiCredentialResponse {
  credential?: string;
}

interface GsiIdApi {
  initialize: (config: {
    client_id: string;
    callback: (response: GsiCredentialResponse) => void;
    auto_select?: boolean;
    cancel_on_tap_outside?: boolean;
    use_fedcm_for_prompt?: boolean;
  }) => void;
  prompt: () => void;
  renderButton: (
    parent: HTMLElement,
    options: {
      type?: string;
      theme?: string;
      size?: string;
      shape?: string;
      text?: string;
      locale?: string;
      width?: number;
    },
  ) => void;
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
  /** When provided, Google's own button is rendered into this element. */
  buttonParentRef?: RefObject<HTMLElement | null>;
  /** Google button label. Defaults to "signin_with". */
  buttonText?: "signin_with" | "continue_with";
}

/**
 * Google One Tap for the login screen.
 *
 * Loads the Google Identity Services SDK, initializes it with the platform's
 * client id and prompts the returning visitor to sign in with one tap. When a
 * container ref is provided it also renders Google's own button there, so the
 * visitor can sign in through the button's popup even when the automatic One
 * Tap prompt is unavailable (one-shot / FedCM disabled). Both routes deliver
 * the same ID token (JWT), which is exchanged for an Appwrite session by the
 * one-tap-login function (server-side verification), never trusted here.
 */
export function GoogleOneTap({
  clientId,
  enabled,
  onSuccess,
  onError,
  onCredential,
  onStart,
  buttonParentRef,
  buttonText,
}: GoogleOneTapProps) {
  const { loginWithOneTap } = useAuth();
  const { colorScheme } = useAppColorScheme();
  const idApiRef = useRef<GsiIdApi | null>(null);

  // Keep the latest callbacks/login in refs so the init effect stays stable
  // across renders instead of re-initializing GSI on every parent render.
  const onSuccessRef = useRef(onSuccess);
  const onErrorRef = useRef(onError);
  const onCredentialRef = useRef(onCredential);
  const onStartRef = useRef(onStart);
  const loginWithOneTapRef = useRef(loginWithOneTap);
  const buttonTextRef = useRef(buttonText);
  onSuccessRef.current = onSuccess;
  onErrorRef.current = onError;
  onCredentialRef.current = onCredential;
  onStartRef.current = onStart;
  loginWithOneTapRef.current = loginWithOneTap;
  buttonTextRef.current = buttonText;

  // Read the scheme from a ref inside the (stable) render callback so a theme
  // change repaints the button without re-initializing GSI or re-prompting.
  const colorSchemeRef = useRef(colorScheme);
  colorSchemeRef.current = colorScheme;

  // Remembers the last (theme, text) pair drawn so a re-render from an
  // unrelated cause does not needlessly wipe and redraw Google's iframe.
  const lastButtonRenderRef = useRef<{ theme: string; text: string } | null>(null);

  const renderGoogleButton = useCallback(
    (idApi: GsiIdApi) => {
      const parent = buttonParentRef?.current;
      if (!parent) return;

      const scheme = colorSchemeRef.current === "dark" ? "dark" : "light";
      const theme = scheme === "dark" ? "filled_black" : "outline";
      const text = buttonTextRef.current ?? "signin_with";
      const last = lastButtonRenderRef.current;
      // The GSI iframe is cross-origin: its canvas follows the container's
      // color-scheme, so keep it in sync even when the button is not redrawn.
      parent.style.colorScheme = scheme;
      // Stable hook for the stylesheet rule that keeps the iframe canvas
      // transparent, including the personalised iframe GSI swaps in later.
      parent.classList.add("google-signin-button");
      if (last && last.theme === theme && last.text === text) return;

      parent.replaceChildren();
      idApi.renderButton(parent, {
        type: "standard",
        theme,
        size: "large",
        shape: "rectangular",
        text,
        locale: "pt-BR",
        width: Math.min(Math.max(parent.clientWidth, 200), 400),
      });
      // Belt and braces: stop a white iframe canvas from showing through the
      // rounded corners.
      parent.querySelectorAll("iframe").forEach((iframe) => {
        iframe.style.setProperty("background-color", "transparent", "important");
      });
      lastButtonRenderRef.current = { theme, text };
    },
    [buttonParentRef],
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

        renderGoogleButton(idApi);

        promptTimer = setTimeout(() => {
          if (cancelled) return;
          // The automatic prompt can throw synchronously (e.g. when the
          // browser blocks it). Ignore it — Google's button still works.
          try {
            idApi.prompt();
          } catch {
            // Nothing to surface: the button render already succeeded.
          }
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
  }, [enabled, clientId, renderGoogleButton]);

  // Repaint Google's button for the new scheme only — GSI was already
  // initialized, so this neither re-initializes nor re-triggers the prompt.
  useEffect(() => {
    const idApi = idApiRef.current;
    if (idApi) renderGoogleButton(idApi);
  }, [colorScheme, renderGoogleButton]);

  return null;
}
