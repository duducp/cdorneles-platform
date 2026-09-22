"use client";

import { useEffect, type ReactNode } from "react";

import { useTenant } from "./tenant-context";

export interface OrgGuardProps {
  children: ReactNode;
  /** Called when org selection is needed. The consumer decides how to navigate. */
  onRedirectToSelectOrg: () => void;
  /**
   * Rendered while the tenant state is still resolving, and when there is
   * nothing to show (no organizations, or a selection is pending). Defaults to
   * nothing; applications pass a loading indicator so the wait is visible.
   */
  fallback?: ReactNode;
}

/**
 * Wraps authenticated content and ensures an active organization exists.
 *
 * - Still loading → render `fallback` (TenantBridge is fetching)
 * - 0 orgs → redirect to `/select-org` (the account has none; create one)
 * - 1 org → already auto-selected by TenantBridge
 * - 2+ orgs with none selected → redirect to `/select-org`
 * - org selected → render children
 */
export function OrgGuard({ children, onRedirectToSelectOrg, fallback = null }: OrgGuardProps) {
  const { organizations, currentOrganization, ready } = useTenant();

  useEffect(() => {
    if (!ready) return;
    // No organization at all: send the user to the picker, where they can
    // create one. Without this the guard sits on the fallback forever.
    if (organizations.length === 0) {
      onRedirectToSelectOrg();
      return;
    }
    if (organizations.length > 1 && !currentOrganization) {
      onRedirectToSelectOrg();
    }
  }, [ready, organizations, currentOrganization, onRedirectToSelectOrg]);

  if (!ready) {
    return <>{fallback}</>;
  }

  if (organizations.length === 0) {
    return <>{fallback}</>;
  }

  if (organizations.length > 1 && !currentOrganization) {
    return <>{fallback}</>;
  }

  return <>{children}</>;
}
