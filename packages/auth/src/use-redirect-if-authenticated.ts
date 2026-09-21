"use client";

import { useEffect } from "react";

import { useAuth } from "./auth-context";

/**
 * Keeps authenticated users away from the auth screens (login, MFA, password
 * recovery) and reports whether the page should render at all.
 *
 * Renders while the session is still being resolved, so the server-rendered
 * form is preserved — hiding it during "loading" would ship an empty page and
 * rely on hydration to fill it. Only a confirmed session hides the form, and
 * the effect then navigates away.
 *
 * The package stays framework-agnostic: navigation is the caller's job, the
 * same way `OrgGuard` takes `onRedirectToSelectOrg`.
 */
export function useRedirectIfAuthenticated(
  enabled: boolean,
  onAuthenticated: () => void,
): boolean {
  const { status } = useAuth();

  useEffect(() => {
    if (enabled && status === "authenticated") {
      onAuthenticated();
    }
  }, [enabled, status, onAuthenticated]);

  if (!enabled) {
    return true;
  }

  return status !== "authenticated";
}
