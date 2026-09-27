"use client";

import { useMantineColorScheme } from "@mantine/core";
import { forwardRef, useCallback, useEffect, useImperativeHandle, useMemo, useRef } from "react";

/** The Cloudflare widget script, loaded at most once per page. */
export const TURNSTILE_SCRIPT_SRC =
  "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";

/** How long nextToken waits for a fresh token before failing. */
const TOKEN_TIMEOUT_MS = 10_000;

const TURNSTILE_MESSAGES = {
  turnstile_not_configured: "Verificação de segurança não configurada neste ambiente.",
  turnstile_unavailable: "Não foi possível concluir a verificação. Tente novamente.",
  turnstile_timeout: "Não foi possível concluir a verificação. Tente novamente.",
} as const;

export type TurnstileErrorCode = keyof typeof TURNSTILE_MESSAGES;

/** Raised by nextToken; `message` is ready to display as-is. */
export class TurnstileError extends Error {
  override name = "TurnstileError";
  constructor(readonly code: TurnstileErrorCode) {
    super(TURNSTILE_MESSAGES[code]);
  }
}

interface TurnstileWidget {
  render(container: HTMLElement, options: Record<string, unknown>): string;
  reset(id: string): void;
  remove(id: string): void;
}

declare global {
  interface Window {
    turnstile?: TurnstileWidget;
  }
}

let scriptPromise: Promise<void> | null = null;

function loadTurnstileScript(): Promise<void> {
  if (typeof window === "undefined") {
    return Promise.reject(new TurnstileError("turnstile_unavailable"));
  }
  if (window.turnstile) {
    return Promise.resolve();
  }
  if (!scriptPromise) {
    scriptPromise = new Promise<void>((resolve, reject) => {
      const script = document.createElement("script");
      script.src = TURNSTILE_SCRIPT_SRC;
      script.async = true;
      script.defer = true;
      script.onload = () => resolve();
      script.onerror = () => {
        script.remove();
        scriptPromise = null;
        reject(new TurnstileError("turnstile_unavailable"));
      };
      document.head.appendChild(script);
    });
  }
  return scriptPromise;
}

export interface TurnstileHandle {
  /**
   * A fresh token: the one already minted, or the next one to arrive.
   * Single-use — a reset fires immediately so the next call waits for a new
   * token. Rejects with TurnstileError.
   */
  nextToken(timeoutMs?: number): Promise<string>;
}

export interface TurnstileProps {
  /** Overrides NEXT_PUBLIC_TURNSTILE_SITE_KEY (tests, previews). */
  siteKey?: string;
}

interface Waiter {
  resolve: (token: string) => void;
  reject: (error: TurnstileError) => void;
  timer: ReturnType<typeof setTimeout>;
}

export const Turnstile = forwardRef<TurnstileHandle, TurnstileProps>(function Turnstile(
  { siteKey },
  ref,
) {
  const { colorScheme } = useMantineColorScheme();
  const resolvedSiteKey = siteKey ?? process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY ?? "";
  const containerRef = useRef<HTMLDivElement | null>(null);
  const widgetIdRef = useRef<string | null>(null);
  const tokenRef = useRef<string | null>(null);
  const waitersRef = useRef<Waiter[]>([]);

  const rejectWaiters = useCallback((error: TurnstileError) => {
    for (const waiter of waitersRef.current.splice(0)) {
      clearTimeout(waiter.timer);
      waiter.reject(error);
    }
  }, []);

  const onToken = useCallback((token: string) => {
    const waiter = waitersRef.current.shift();
    if (waiter) {
      clearTimeout(waiter.timer);
      waiter.resolve(token);
      // Handed over: pre-mint the next token right away.
      if (widgetIdRef.current) window.turnstile?.reset(widgetIdRef.current);
      return;
    }
    tokenRef.current = token;
  }, []);

  const onError = useCallback(() => {
    tokenRef.current = null;
    rejectWaiters(new TurnstileError("turnstile_unavailable"));
  }, [rejectWaiters]);

  const onExpired = useCallback(() => {
    tokenRef.current = null;
    if (widgetIdRef.current) window.turnstile?.reset(widgetIdRef.current);
  }, []);

  useImperativeHandle(
    ref,
    (): TurnstileHandle => ({
      async nextToken(timeoutMs = TOKEN_TIMEOUT_MS) {
        if (!resolvedSiteKey) {
          throw new TurnstileError("turnstile_not_configured");
        }
        const current = tokenRef.current;
        if (current !== null) {
          tokenRef.current = null;
          if (widgetIdRef.current) window.turnstile?.reset(widgetIdRef.current);
          return current;
        }
        return new Promise<string>((resolve, reject) => {
          const timer = setTimeout(() => {
            const index = waitersRef.current.findIndex((waiter) => waiter.timer === timer);
            if (index >= 0) waitersRef.current.splice(index, 1);
            reject(new TurnstileError("turnstile_timeout"));
          }, timeoutMs);
          waitersRef.current.push({ resolve, reject, timer });
        });
      },
    }),
    [resolvedSiteKey],
  );

  useEffect(() => {
    if (!resolvedSiteKey || !containerRef.current) return;
    let disposed = false;
    void loadTurnstileScript()
      .then(() => {
        if (disposed || !containerRef.current || !window.turnstile) return;
        widgetIdRef.current = window.turnstile.render(containerRef.current, {
          sitekey: resolvedSiteKey,
          theme: colorScheme === "dark" ? "dark" : "light",
          // Only render the widget when user interaction is required; the
          // common no-interaction flow stays visually empty.
          appearance: "interaction-only",
          callback: onToken,
          "error-callback": onError,
          "expired-callback": onExpired,
        });
      })
      .catch((error: unknown) => {
        if (!disposed) {
          rejectWaiters(
            error instanceof TurnstileError ? error : new TurnstileError("turnstile_unavailable"),
          );
        }
      });
    return () => {
      disposed = true;
      if (widgetIdRef.current && window.turnstile) {
        window.turnstile.remove(widgetIdRef.current);
        widgetIdRef.current = null;
      }
      tokenRef.current = null;
      rejectWaiters(new TurnstileError("turnstile_unavailable"));
    };
  }, [resolvedSiteKey, colorScheme, onToken, onError, onExpired, rejectWaiters]);

  return <div ref={containerRef} />;
});

/**
 * One widget per screen: the page owns the token (`nextToken` for every
 * service call) and passes `<Turnstile ref={handleRef} />` to the form's
 * `captchaSlot`.
 */
export function useTurnstile() {
  const handleRef = useRef<TurnstileHandle>(null);
  const nextToken = useCallback(async (): Promise<string> => {
    if (!handleRef.current) {
      throw new TurnstileError("turnstile_unavailable");
    }
    return handleRef.current.nextToken();
  }, []);
  // Stable identity: pages put this object in effect/callback deps, so a fresh
  // literal per render would re-run effects (e.g. the MFA bootstrap would mint
  // a duplicate challenge every render).
  return useMemo(() => ({ handleRef, nextToken }), [nextToken]);
}
