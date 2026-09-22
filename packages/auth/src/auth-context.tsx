"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";

import { isUnauthorized } from "@cdorneles/api-client";

import type { SessionSignal } from "./session-signal";
import type { AuthService, AuthSession, AuthUser, CompleteMfaInput, LoginInput } from "./types";

export type AuthStatus = "loading" | "authenticated" | "anonymous";

const SESSION_COOKIE = "cdorneles-session";

/**
 * Screens an anonymous visitor must be able to reach. A stale session cookie
 * (24h client-side hint) must not bounce them back to `/login` in a circle.
 */
const PUBLIC_AUTH_PREFIXES = ["/login", "/mfa", "/forgot-password", "/reset-password"];

/** How often to check session validity (ms). */
const SESSION_POLL_INTERVAL = 4 * 60 * 1000; // 4 minutes

/** How far before expiry to consider a session "about to expire" (ms). */
const EXPIRY_WARNING_MS = 5 * 60 * 1000; // 5 minutes

function setSessionCookie(): void {
  if (typeof document === "undefined") return;
  document.cookie = `${SESSION_COOKIE}=1; path=/; SameSite=Lax; max-age=86400`;
}

function clearSessionCookie(): void {
  if (typeof document === "undefined") return;
  document.cookie = `${SESSION_COOKIE}=; path=/; SameSite=Lax; max-age=0`;
}

function hasSessionCookie(): boolean {
  if (typeof document === "undefined") return false;
  return document.cookie.split("; ").some((entry) => {
    const [name, value] = entry.split("=");
    return name === SESSION_COOKIE && value === "1";
  });
}

function isExpiringSoon(expiresAt: string): boolean {
  return new Date(expiresAt).getTime() - Date.now() <= EXPIRY_WARNING_MS;
}

/**
 * Where the session stands.
 *
 * - `active`   — valid
 * - `expiring` — still valid, dies within five minutes; the toast warns
 * - `expired`  — gone while the app was running; the dialog asks for the password
 */
export type SessionState = "active" | "expiring" | "expired";

export interface AuthContextValue {
  service: AuthService;
  user: AuthUser | null;
  session: AuthSession | null;
  status: AuthStatus;
  sessionState: SessionState;
  login: (input: LoginInput) => Promise<AuthSession>;
  completeMfa: (input: CompleteMfaInput) => Promise<AuthSession>;
  /** Re-authenticates after the session died, in place, without navigating. */
  reauthenticate: (input: LoginInput) => Promise<AuthSession>;
  /** Completes the MFA step of a re-authentication, in place. */
  completeReauthMfa: (input: CompleteMfaInput) => Promise<AuthSession>;
  logout: (sessionId?: string) => Promise<void>;
  refresh: () => Promise<void>;
  renewSession: () => Promise<AuthSession>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export interface AuthProviderProps {
  service: AuthService;
  children: ReactNode;
  initialUser?: AuthUser | null;
  initialSession?: AuthSession | null;
  /** Where to send a bootstrap whose session cookie outlived the session. Defaults to /login. */
  loginPath?: string;
  /** Carries a 401 seen by the query client. */
  sessionSignal?: SessionSignal;
}

/**
 * Holds the authenticated identity for the UI.
 *
 * - Bootstraps session on mount via `refresh()`
 * - Polls session validity every 4 minutes
 * - Reports `sessionState`: `expiring` within 5 minutes, `expired` once gone
 * - Redirects to `/login` only on bootstrap, when the session cookie was
 *   present but the server session is gone. A session that dies while the app
 *   is running stays on the page and is reported through `sessionState`.
 */
export function AuthProvider({
  service,
  children,
  initialUser = null,
  initialSession = null,
  loginPath = "/login",
  sessionSignal,
}: AuthProviderProps) {
  const [user, setUser] = useState<AuthUser | null>(initialUser);
  const [session, setSession] = useState<AuthSession | null>(initialSession);
  // Start in "loading" when no user was provided so the bootstrap effect below
  // runs. Defaulting to "anonymous" meant refresh() was never called, so an
  // existing Appwrite session was never restored and the app behaved as if
  // signed out after every reload.
  const [status, setStatus] = useState<AuthStatus>(initialUser ? "authenticated" : "loading");
  const [sessionState, setSessionState] = useState<SessionState>("active");
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const redirectToLogin = useCallback(() => {
    if (typeof window === "undefined") return;
    const { pathname } = window.location;
    if (pathname.startsWith(loginPath)) return;
    if (PUBLIC_AUTH_PREFIXES.some((prefix) => pathname.startsWith(prefix))) return;
    window.location.href = `${loginPath}?redirect=${encodeURIComponent(pathname)}`;
  }, [loginPath]);

  const refresh = useCallback(async () => {
    setStatus("loading");
    try {
      const [nextSession, nextUser] = await Promise.all([
        service.getSession(),
        service.getCurrentUser(),
      ]);
      setSession(nextSession);
      setUser(nextUser);
      const isAuth = !!nextUser;
      setStatus(isAuth ? "authenticated" : "anonymous");
      if (isAuth) {
        setSessionCookie();
        setSessionState(
          nextSession && isExpiringSoon(nextSession.expiresAt) ? "expiring" : "active",
        );
      } else {
        // The cookie is a client-side hint with a 24h max-age, so it can outlive
        // the server session. If it was present, a session was expected and the
        // fresh load has landed in a shell with no user: send it to /login.
        // Without it the visitor is genuinely anonymous (e.g. reading
        // /forgot-password) and must stay put. The catch below is a failed
        // check (network or server), not a confirmed sign-out, so it does not
        // navigate.
        const expected = hasSessionCookie();
        clearSessionCookie();
        setSessionState("active");
        if (expected) {
          redirectToLogin();
        }
      }
    } catch {
      setSession(null);
      setUser(null);
      setStatus("anonymous");
      setSessionState("active");
      clearSessionCookie();
    }
  }, [service, redirectToLogin]);

  // Bootstrap session on mount
  useEffect(() => {
    if (status === "loading") {
      refresh();
    }
  }, [status, refresh]);

  // Read the latest user without making `markExpired` depend on it: the signal
  // subscription effect must stay stable across renders.
  const userRef = useRef(user);
  userRef.current = user;

  // The session died while the app was running. Keep the cookie and stay on the
  // page: the dialog restores the session without discarding the React tree.
  const markExpired = useCallback(() => {
    // A 401 while anonymous is not a dead session: setting `authenticated` here
    // would fabricate an identity and hide the login form.
    if (!userRef.current) return;
    setSessionState("expired");
    setStatus("authenticated");
  }, []);

  // A 401 from any request reaches the query client, not the auth state.
  useEffect(() => {
    if (!sessionSignal) return;
    return sessionSignal.subscribe(markExpired);
  }, [sessionSignal, markExpired]);

  // Poll session validity. The check goes to the server rather than comparing
  // the stored expiry locally: a session can be revoked (password changed,
  // signed out elsewhere) long before its timestamp says so.
  useEffect(() => {
    if (status !== "authenticated") return;

    let cancelled = false;

    pollRef.current = setInterval(async () => {
      let nextSession: AuthSession | null;
      try {
        nextSession = await service.getSession();
      } catch {
        // A failed check is not a confirmed sign-out. Retry next tick.
        return;
      }
      // The effect may have been torn down (unmount, status or service change)
      // while the request was in flight; do not touch state afterwards.
      if (cancelled) return;
      if (!nextSession) {
        markExpired();
        return;
      }
      setSession(nextSession);
      setSessionState(isExpiringSoon(nextSession.expiresAt) ? "expiring" : "active");
    }, SESSION_POLL_INTERVAL);

    return () => {
      cancelled = true;
      if (pollRef.current) {
        clearInterval(pollRef.current);
        pollRef.current = null;
      }
    };
  }, [status, service, markExpired]);

  // Every successful credential exchange lands here: one place decides what a
  // fresh identity means for session, user, status, cookie and dialog state.
  const applyAuthenticatedSession = useCallback(
    (nextSession: AuthSession, nextUser: AuthUser | null) => {
      setSession(nextSession);
      setUser(nextUser);
      setStatus(nextUser ? "authenticated" : "anonymous");
      setSessionState("active");
      if (nextUser) setSessionCookie();
    },
    [],
  );

  const login = useCallback(
    async (input: LoginInput) => {
      const nextSession = await service.login(input);
      const nextUser = await service.getCurrentUser();
      applyAuthenticatedSession(nextSession, nextUser);
      return nextSession;
    },
    [service, applyAuthenticatedSession],
  );

  const completeMfa = useCallback(
    async (input: CompleteMfaInput) => {
      const nextSession = await service.completeMfa(input);
      const nextUser = await service.getCurrentUser();
      applyAuthenticatedSession(nextSession, nextUser);
      return nextSession;
    },
    [service, applyAuthenticatedSession],
  );

  // Re-authentication after the session died. Deliberately NOT the login page's
  // flow: that one navigates to /mfa on MfaRequiredError, which would discard
  // the very page this exists to preserve. Here the error propagates so the
  // dialog can switch to its MFA step in place.
  const reauthenticate = useCallback(
    async (input: LoginInput) => {
      const nextSession = await service.login(input);
      const nextUser = await service.getCurrentUser();
      applyAuthenticatedSession(nextSession, nextUser);
      return nextSession;
    },
    [service, applyAuthenticatedSession],
  );

  const completeReauthMfa = useCallback(
    async (input: CompleteMfaInput) => {
      const nextSession = await service.completeMfa(input);
      const nextUser = await service.getCurrentUser();
      applyAuthenticatedSession(nextSession, nextUser);
      return nextSession;
    },
    [service, applyAuthenticatedSession],
  );

  const renewSession = useCallback(async () => {
    try {
      const nextSession = await service.renewSession();
      setSession(nextSession);
      setSessionState(isExpiringSoon(nextSession.expiresAt) ? "expiring" : "active");
      return nextSession;
    } catch (error) {
      // A dead session cannot be extended. Move the provider to "expired" so the
      // re-authentication dialog opens, then rethrow for the caller.
      if (isUnauthorized(error)) {
        markExpired();
      }
      throw error;
    }
  }, [service, markExpired]);

  const logout = useCallback(
    async (sessionId?: string) => {
      await service.logout(sessionId);
      setSession(null);
      setUser(null);
      setStatus("anonymous");
      setSessionState("active");
      clearSessionCookie();
    },
    [service],
  );

  const value = useMemo<AuthContextValue>(
    () => ({
      service,
      user,
      session,
      status,
      sessionState,
      login,
      completeMfa,
      reauthenticate,
      completeReauthMfa,
      logout,
      refresh,
      renewSession,
    }),
    [
      service,
      user,
      session,
      status,
      sessionState,
      login,
      completeMfa,
      reauthenticate,
      completeReauthMfa,
      logout,
      refresh,
      renewSession,
    ],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within <AuthProvider>.");
  }
  return context;
}
