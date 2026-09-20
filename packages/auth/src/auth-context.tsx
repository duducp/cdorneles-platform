"use client";

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";

import type { AuthService, AuthSession, AuthUser, CompleteMfaInput, LoginInput } from "./types";

export type AuthStatus = "loading" | "authenticated" | "anonymous";

export interface AuthContextValue {
  service: AuthService;
  user: AuthUser | null;
  session: AuthSession | null;
  status: AuthStatus;
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
}

/**
 * Holds the authenticated identity for the UI. Session bootstrap/refresh is
 * triggered explicitly by the application (`refresh`), so no network call is
 * made during the Foundation phase.
 */
export function AuthProvider({
  service,
  children,
  initialUser = null,
  initialSession = null,
}: AuthProviderProps) {
  const [user, setUser] = useState<AuthUser | null>(initialUser);
  const [session, setSession] = useState<AuthSession | null>(initialSession);
  const [status, setStatus] = useState<AuthStatus>(initialUser ? "authenticated" : "anonymous");

  const refresh = useCallback(async () => {
    setStatus("loading");
    const [nextSession, nextUser] = await Promise.all([
      service.getSession(),
      service.getCurrentUser(),
    ]);
    setSession(nextSession);
    setUser(nextUser);
    setStatus(nextUser ? "authenticated" : "anonymous");
  }, [service]);

  const login = useCallback(
    async (input: LoginInput) => {
      const nextSession = await service.login(input);
      const nextUser = await service.getCurrentUser();
      setSession(nextSession);
      setUser(nextUser);
      setStatus(nextUser ? "authenticated" : "anonymous");
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
    },
    [service],
  );

  const value = useMemo<AuthContextValue>(
    () => ({ service, user, session, status, login, completeMfa, logout, refresh }),
    [service, user, session, status, login, completeMfa, logout, refresh],
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
