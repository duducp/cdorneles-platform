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

import { MfaRequiredError } from "./errors";
import type { SessionSignal } from "./session-signal";
import type {
  AuthService,
  AuthSession,
  AuthUser,
  CompleteMfaInput,
  LoginInput,
  OneTapLoginInput,
} from "./types";

export type AuthStatus = "loading" | "authenticated" | "anonymous";

const SESSION_COOKIE = "cdorneles-session";

/**
 * Screens an anonymous visitor must be able to reach. A stale session cookie
 * (24h client-side hint) must not bounce them back to `/login` in a circle.
 */
const PUBLIC_AUTH_PREFIXES = ["/login", "/mfa", "/forgot-password", "/reset-password"];

/** How often to check session validity (ms). */
const SESSION_POLL_INTERVAL = 4 * 60 * 1000; // 4 minutes

/** How far before expiry to warn that the session is about to expire (ms). */
const WARNING_15M_MS = 15 * 60 * 1000; // 15 minutes
const WARNING_5M_MS = 5 * 60 * 1000; // 5 minutes

/**
 * The step of the expiry warning currently shown:
 *
 * - `none` — more than 15 minutes left, or no live session
 * - `15m`  — the 15-minute threshold was crossed while watching
 * - `5m`   — the 5-minute threshold was crossed (or the session was born inside it)
 */
export type ExpiryWarning = "none" | "15m" | "5m";

/**
 * Largest delay `setTimeout` honours. A larger delay overflows the 32-bit timer
 * and fires ~immediately, which would flash the 5-minute warning for a session
 * (Appwrite's default is a year) that is nowhere near expiring. Long waits are
 * therefore capped and re-armed.
 */
const MAX_TIMEOUT_MS = 2_147_483_647; // 2^31 - 1 milliseconds (~24.8 days)

/**
 * After a fresh session lands, 401s are ignored for this long (ms). The window
 * BOUNDS the stale-401 race, it does not close it: it only covers stale 401s
 * from work that was already in flight when the re-auth landed. A genuine 401
 * after the window still expires the app, and a genuine revocation that lands
 * inside the window is not lost — the poll is the backstop, so it is merely
 * delayed until the next poll. Any 401 seen during the window is therefore
 * masked, not proven stale.
 */
export const SIGNAL_SUPPRESSION_MS = 5_000;

/** `Secure` when served over HTTPS so the hint is not sent in the clear. */
function sessionCookieSecure(): string {
  return typeof location !== "undefined" && location.protocol === "https:" ? "; Secure" : "";
}

function setSessionCookie(): void {
  if (typeof document === "undefined") return;
  document.cookie = `${SESSION_COOKIE}=1; path=/; SameSite=Lax; max-age=86400${sessionCookieSecure()}`;
}

function clearSessionCookie(): void {
  if (typeof document === "undefined") return;
  document.cookie = `${SESSION_COOKIE}=; path=/; SameSite=Lax; max-age=0${sessionCookieSecure()}`;
}

function hasSessionCookie(): boolean {
  if (typeof document === "undefined") return false;
  return document.cookie.split("; ").some((entry) => {
    const [name, value] = entry.split("=");
    return name === SESSION_COOKIE && value === "1";
  });
}

/**
 * Where the session stands.
 *
 * - `active`  — valid
 * - `expired` — gone while the app was running; the dialog asks for the password
 */
export type SessionState = "active" | "expired";

export interface AuthContextValue {
  service: AuthService;
  user: AuthUser | null;
  session: AuthSession | null;
  status: AuthStatus;
  sessionState: SessionState;
  /** Which expiry warning the UI should show, derived from the session expiry. */
  expiryWarning: ExpiryWarning;
  login: (input: LoginInput) => Promise<AuthSession>;
  /** Signs in with a Google One Tap ID token and establishes the session. */
  loginWithOneTap: (input: OneTapLoginInput) => Promise<AuthSession>;
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
  /**
   * Fired synchronously whenever the authenticated identity changes (login,
   * logout, or a different user), before the new state is committed. Use it to
   * drop per-user caches so another account never reads the previous one's data.
   */
  onUserChange?: (previousUserId: string | null, nextUserId: string | null) => void;
}

/**
 * Holds the authenticated identity for the UI.
 *
 * - Bootstraps session on mount via `refresh()`
 * - Polls session validity every 4 minutes
 * - Reports `sessionState`: `expired` once the session is gone; the
 *   about-to-expire steps are reported through `expiryWarning` instead
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
  onUserChange,
}: AuthProviderProps) {
  const [user, setUser] = useState<AuthUser | null>(initialUser);
  const [session, setSession] = useState<AuthSession | null>(initialSession);
  // Start in "loading" when no user was provided so the bootstrap effect below
  // runs. Defaulting to "anonymous" meant refresh() was never called, so an
  // existing Appwrite session was never restored and the app behaved as if
  // signed out after every reload.
  const [status, setStatus] = useState<AuthStatus>(initialUser ? "authenticated" : "loading");
  const [sessionState, setSessionState] = useState<SessionState>("active");
  const [expiryWarning, setExpiryWarning] = useState<ExpiryWarning>("none");
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // The identity transitions through a handful of paths (login, a restored
  // bootstrap session, logout, a cleared identity). The callback that drops
  // per-user caches fires on the transition itself, synchronously, rather than
  // from a passive effect one render later. Keep the latest callback in a ref
  // so it never forces those paths to change identity, and track the committed
  // id so a same-user refresh is a no-op.
  const onUserChangeRef = useRef(onUserChange);
  onUserChangeRef.current = onUserChange;
  const currentUserIdRef = useRef<string | null>(initialUser?.id ?? null);

  const commitUserId = useCallback((nextUserId: string | null) => {
    const previousUserId = currentUserIdRef.current;
    if (previousUserId === nextUserId) return;
    currentUserIdRef.current = nextUserId;
    onUserChangeRef.current?.(previousUserId, nextUserId);
  }, []);

  const redirectToLogin = useCallback(() => {
    if (typeof window === "undefined") return;
    const { pathname } = window.location;
    if (pathname.startsWith(loginPath)) return;
    if (PUBLIC_AUTH_PREFIXES.some((prefix) => pathname.startsWith(prefix))) return;
    window.location.href = `${loginPath}?redirect=${encodeURIComponent(pathname)}`;
  }, [loginPath]);

  const redirectToMfa = useCallback(() => {
    if (typeof window === "undefined") return;
    const { pathname } = window.location;
    // Already on the challenge page: getSession/getCurrentUser stay blocked
    // while the pending-MFA cookie exists — redirecting again would loop.
    if (pathname.startsWith("/mfa")) return;
    window.location.href = `/mfa?redirect=${encodeURIComponent(pathname)}`;
  }, []);

  const refresh = useCallback(async () => {
    setStatus("loading");

    // A confirmed sign-out: clear identity and the client-side hint. The cookie
    // is a client-side hint with a 24h max-age, so it can outlive the server
    // session. If it was present, a session was expected and the fresh load has
    // landed in a shell with no user: send it to /login. Without it the visitor
    // is genuinely anonymous (e.g. reading /forgot-password) and must stay put.
    const applySignedOut = () => {
      setSession(null);
      setUser(null);
      setStatus("anonymous");
      setSessionState("active");
      commitUserId(null);
      const expected = hasSessionCookie();
      clearSessionCookie();
      if (expected) {
        redirectToLogin();
      }
    };

    try {
      // Resolve the session before the user. `getCurrentUser` rethrows a 401
      // rather than resolving null, so joining the two with Promise.all would
      // reject on a stale cookie before the signed-out branch below could clear
      // it and redirect.
      const nextSession = await service.getSession();

      if (!nextSession) {
        applySignedOut();
        return;
      }

      const nextUser = await service.getCurrentUser();
      setSession(nextSession);
      setUser(nextUser);
      commitUserId(nextUser?.id ?? null);
      const isAuth = !!nextUser;
      setStatus(isAuth ? "authenticated" : "anonymous");
      if (isAuth) {
        setSessionCookie();
        setSessionState("active");
      } else {
        setSessionState("active");
        clearSessionCookie();
      }
    } catch (error) {
      if (error instanceof MfaRequiredError) {
        setSession(null);
        setUser(null);
        setStatus("anonymous");
        setSessionState("active");
        commitUserId(null);
        clearSessionCookie();
        redirectToMfa();
        return;
      }
      if (isUnauthorized(error)) {
        // The server confirmed the session is gone — treat it exactly like a
        // missing session rather than a transient failure.
        applySignedOut();
        return;
      }
      // A failed check (network or server), not a confirmed sign-out: clear any
      // partial identity but do not navigate.
      setSession(null);
      setUser(null);
      setStatus("anonymous");
      setSessionState("active");
      commitUserId(null);
      clearSessionCookie();
    }
  }, [service, redirectToLogin, redirectToMfa, commitUserId]);

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

  // Epoch ms until which a 401 signal is ignored. A fresh session opens a
  // short window (applyAuthenticatedSession) so a stale 401 from a request
  // that was in flight when it landed cannot reopen the dialog; once the
  // deadline passes a genuine 401 expires again. The window only bounds that
  // race: a 401 inside it is masked regardless of cause, and the poll is the
  // backstop that still notices a genuine revocation. Reset on logout.
  const suppressExpiredUntilRef = useRef(0);

  // Bumped on every fresh session so an in-flight poll started against the
  // previous session cannot expire the one that replaced it.
  const sessionGenerationRef = useRef(0);

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
    return sessionSignal.subscribe(() => {
      // A stale 401 from a request started before a fresh session landed is
      // ignored until the suppression window lapses; this bounds the race
      // rather than closing it, so a genuine 401 inside the window is masked
      // too — the poll is the backstop. After the window a genuine 401
      // expires.
      if (Date.now() < suppressExpiredUntilRef.current) return;
      markExpired();
    });
  }, [sessionSignal, markExpired]);

  // Poll session validity. The check goes to the server rather than comparing
  // the stored expiry locally: a session can be revoked (password changed,
  // signed out elsewhere) long before its timestamp says so.
  useEffect(() => {
    // A session known to be dead needs no further checks.
    if (status !== "authenticated" || sessionState === "expired") return;

    let cancelled = false;

    pollRef.current = setInterval(async () => {
      const generation = sessionGenerationRef.current;
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
      // A reauthentication replaced the session while this check was in flight;
      // its result describes the previous session and must be ignored.
      if (sessionGenerationRef.current !== generation) return;
      if (!nextSession) {
        markExpired();
        return;
      }
      setSession(nextSession);
      setSessionState("active");
    }, SESSION_POLL_INTERVAL);

    return () => {
      cancelled = true;
      if (pollRef.current) {
        clearInterval(pollRef.current);
        pollRef.current = null;
      }
    };
  }, [status, sessionState, service, markExpired]);

  // Derive the expiry warning from the session's expiry with timers rather than
  // from the 4-minute poll, which is too coarse to hit the 15- and 5-minute
  // marks. The crossing rule: only emit "15m" when the 15-minute mark is
  // actually crossed while watching. A session born inside the window (e.g. a
  // short-lived one) never observed that crossing, so it goes straight to "5m".
  // Depend on the whole `session`: a renewal (new expiry) or logout (null)
  // must reschedule, while the poll's identity-only refresh (a fresh object
  // with the same expiry every 4 minutes) must not. The crossing flag therefore
  // lives in refs keyed by `expiresAt` and only resets when the expiry itself
  // changes; each run re-derives the warning from the current position.
  const lastExpiryKeyRef = useRef<string | undefined>(undefined);
  const crossed15mRef = useRef(false);
  useEffect(() => {
    const expiresAt = session?.expiresAt;
    if (lastExpiryKeyRef.current !== expiresAt) {
      lastExpiryKeyRef.current = expiresAt;
      crossed15mRef.current = false;
    }

    const deadline = expiresAt ? new Date(expiresAt).getTime() : Number.NaN;
    if (!Number.isFinite(deadline)) {
      setExpiryWarning("none");
      return;
    }

    const remaining = deadline - Date.now();
    if (remaining <= 0) {
      setExpiryWarning("none");
      return;
    }

    if (remaining <= WARNING_5M_MS) {
      crossed15mRef.current = true;
      setExpiryWarning("5m");
    } else if (remaining <= WARNING_15M_MS) {
      // Inside the 15-minute window: keep the warning only if this expiry was
      // observed crossing the mark; otherwise stay silent.
      setExpiryWarning(crossed15mRef.current ? "15m" : "none");
    } else {
      setExpiryWarning("none");
    }

    const timers = new Set<ReturnType<typeof setTimeout>>();

    // Arm a single threshold crossing. The wait is recomputed each time so a
    // capped (long) wait re-arms instead of firing early, and the warning only
    // lands once the deadline actually reaches the threshold. Observing the
    // 15-minute mark records the crossing so later re-runs keep the warning.
    const armCrossing = (thresholdMs: number, warning: ExpiryWarning) => {
      const delay = deadline - Date.now() - thresholdMs;
      if (delay <= 0) {
        if (warning === "15m") crossed15mRef.current = true;
        setExpiryWarning(warning);
        return;
      }
      const timer = setTimeout(() => {
        timers.delete(timer);
        armCrossing(thresholdMs, warning);
      }, Math.min(delay, MAX_TIMEOUT_MS));
      timers.add(timer);
    };

    if (remaining > WARNING_15M_MS) {
      armCrossing(WARNING_15M_MS, "15m");
    }

    if (remaining > WARNING_5M_MS) {
      armCrossing(WARNING_5M_MS, "5m");
    }

    // The deadline itself: drop the warning the moment the session dies
    // instead of waiting for the next poll to notice.
    const deadlineTimer = setTimeout(() => {
      setExpiryWarning("none");
    }, Math.min(remaining, MAX_TIMEOUT_MS));
    timers.add(deadlineTimer);

    return () => {
      for (const timer of timers) clearTimeout(timer);
      timers.clear();
    };
  }, [session]);

  // Every successful credential exchange lands here: one place decides what a
  // fresh identity means for session, user, status, cookie and dialog state.
  const applyAuthenticatedSession = useCallback(
    (nextSession: AuthSession, nextUser: AuthUser | null) => {
      setSession(nextSession);
      setUser(nextUser);
      commitUserId(nextUser?.id ?? null);
      setStatus(nextUser ? "authenticated" : "anonymous");
      setSessionState("active");
      if (nextUser) setSessionCookie();
      // A fresh session opens a short window in which stale 401s from requests
      // started before it are ignored, and invalidates any poll started against
      // the session it replaces. The window bounds the stale-401 race without
      // closing it; the poll remains the backstop for a genuine revocation.
      suppressExpiredUntilRef.current = Date.now() + SIGNAL_SUPPRESSION_MS;
      sessionGenerationRef.current += 1;
    },
    [commitUserId],
  );

  // Shared tail for every credential exchange: fetch the user for the freshly
  // issued session and commit it. `login`/`completeMfa` and their
  // reauthentication counterparts differ only in which call mints the session.
  const finishAuthentication = useCallback(
    async (nextSession: AuthSession) => {
      const nextUser = await service.getCurrentUser();
      applyAuthenticatedSession(nextSession, nextUser);
      return nextSession;
    },
    [service, applyAuthenticatedSession],
  );

  const login = useCallback(
    async (input: LoginInput) => finishAuthentication(await service.login(input)),
    [service, finishAuthentication],
  );

  const loginWithOneTap = useCallback(
    async (input: OneTapLoginInput) => finishAuthentication(await service.loginWithOneTap(input)),
    [service, finishAuthentication],
  );

  const completeMfa = useCallback(
    async (input: CompleteMfaInput) => finishAuthentication(await service.completeMfa(input)),
    [service, finishAuthentication],
  );

  // Re-authentication after the session died. Deliberately NOT the login page's
  // flow: that one navigates to /mfa on MfaRequiredError, which would discard
  // the very page this exists to preserve. Here the error propagates so the
  // dialog can switch to its MFA step in place.
  const reauthenticate = useCallback(
    async (input: LoginInput) => finishAuthentication(await service.login(input)),
    [service, finishAuthentication],
  );

  const completeReauthMfa = useCallback(
    async (input: CompleteMfaInput) => finishAuthentication(await service.completeMfa(input)),
    [service, finishAuthentication],
  );

  const renewSession = useCallback(async () => {
    try {
      const nextSession = await service.renewSession();
      setSession(nextSession);
      setSessionState("active");
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
      commitUserId(null);
      clearSessionCookie();
      suppressExpiredUntilRef.current = 0;
    },
    [service, commitUserId],
  );

  const value = useMemo<AuthContextValue>(
    () => ({
      service,
      user,
      session,
      status,
      sessionState,
      expiryWarning,
      login,
      loginWithOneTap,
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
      expiryWarning,
      login,
      loginWithOneTap,
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
