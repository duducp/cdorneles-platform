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
 * - 0 orgs → render `fallback` (account needs invite)
 * - 1 org → already auto-selected by TenantBridge
 * - 2+ orgs with none selected → call onRedirectToSelectOrg
 * - org selected → render children
 */
export function OrgGuard({ children, onRedirectToSelectOrg, fallback = null }: OrgGuardProps) {
  const { organizations, currentOrganization, ready } = useTenant();

  useEffect(() => {
    if (!ready) return;
    if (organizations.length <= 1) return;
    if (!currentOrganization) {
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
