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

import type { AuthService, AuthSession, AuthUser, CompleteMfaInput, LoginInput } from "./types";

export type AuthStatus = "loading" | "authenticated" | "anonymous";

const SESSION_COOKIE = "cdorneles-session";

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

function isExpired(expiresAt: string): boolean {
  return new Date(expiresAt).getTime() <= Date.now();
}

function isExpiringSoon(expiresAt: string): boolean {
  return new Date(expiresAt).getTime() - Date.now() <= EXPIRY_WARNING_MS;
}

export interface AuthContextValue {
  service: AuthService;
  user: AuthUser | null;
  session: AuthSession | null;
  status: AuthStatus;
  /** True when the session is valid but will expire within 5 minutes. */
  sessionExpiring: boolean;
  login: (input: LoginInput) => Promise<AuthSession>;
  completeMfa: (input: CompleteMfaInput) => Promise<AuthSession>;
  logout: (sessionId?: string) => Promise<void>;
  refresh: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export interface AuthProviderProps {
  service: AuthService;
  children: ReactNode;
  initialUser?: AuthUser | null;
  initialSession?: AuthSession | null;
  /** Custom redirect URL when session expires. Defaults to /login. */
  loginPath?: string;
}

/**
 * Holds the authenticated identity for the UI.
 *
 * - Bootstraps session on mount via `refresh()`
 * - Polls session validity every 4 minutes
 * - Sets `sessionExpiring` flag when expiry is within 5 minutes
 * - Redirects to `/login` when session expires or is invalid
 */
export function AuthProvider({
  service,
  children,
  initialUser = null,
  initialSession = null,
  loginPath = "/login",
}: AuthProviderProps) {
  const [user, setUser] = useState<AuthUser | null>(initialUser);
  const [session, setSession] = useState<AuthSession | null>(initialSession);
  const [status, setStatus] = useState<AuthStatus>(initialUser ? "authenticated" : "anonymous");
  const [sessionExpiring, setSessionExpiring] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const redirectToLogin = useCallback(() => {
    if (typeof window === "undefined") return;
    const { pathname } = window.location;
    if (pathname.startsWith(loginPath)) return;
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
        setSessionExpiring(nextSession ? isExpiringSoon(nextSession.expiresAt) : false);
      } else {
        clearSessionCookie();
        setSessionExpiring(false);
      }
    } catch {
      setSession(null);
      setUser(null);
      setStatus("anonymous");
      setSessionExpiring(false);
      clearSessionCookie();
    }
  }, [service]);

  // Bootstrap session on mount
  useEffect(() => {
    if (status === "loading") {
      refresh();
    }
  }, [status, refresh]);

  // Poll session validity
  useEffect(() => {
    if (status !== "authenticated") return;

    pollRef.current = setInterval(() => {
      const currentSession = session;
      if (!currentSession) return;

      if (isExpired(currentSession.expiresAt)) {
        clearInterval(pollRef.current!);
        setSession(null);
        setUser(null);
        setStatus("anonymous");
        setSessionExpiring(false);
        clearSessionCookie();
        redirectToLogin();
        return;
      }

      if (isExpiringSoon(currentSession.expiresAt)) {
        setSessionExpiring(true);
      }
    }, SESSION_POLL_INTERVAL);

    return () => {
      if (pollRef.current) {
        clearInterval(pollRef.current);
      }
    };
  }, [status, session, redirectToLogin]);

  const login = useCallback(
    async (input: LoginInput) => {
      const nextSession = await service.login(input);
      const nextUser = await service.getCurrentUser();
      setSession(nextSession);
      setUser(nextUser);
      setStatus(nextUser ? "authenticated" : "anonymous");
      setSessionExpiring(false);
      if (nextUser) setSessionCookie();
      return nextSession;
    },
    [service],
  );

  const completeMfa = useCallback(
    async (input: CompleteMfaInput) => {
      const nextSession = await service.completeMfa(input);
      const nextUser = await service.getCurrentUser();
      setSession(nextSession);
      setUser(nextUser);
      setStatus(nextUser ? "authenticated" : "anonymous");
      setSessionExpiring(false);
      if (nextUser) setSessionCookie();
      return nextSession;
    },
    [service],
  );

  const logout = useCallback(
    async (sessionId?: string) => {
      await service.logout(sessionId);
      setSession(null);
      setUser(null);
      setStatus("anonymous");
      setSessionExpiring(false);
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
      sessionExpiring,
      login,
      completeMfa,
      logout,
      refresh,
    }),
    [service, user, session, status, sessionExpiring, login, completeMfa, logout, refresh],
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
