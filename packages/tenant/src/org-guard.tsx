"use client";

import { useEffect, type ReactNode } from "react";

import { useTenant } from "./tenant-context";

export interface OrgGuardProps {
  children: ReactNode;
  /** Called when org selection is needed. The consumer decides how to navigate. */
  onRedirectToSelectOrg: () => void;
}

/**
 * Wraps authenticated content and ensures an active organization exists.
 *
 * - Still loading → render nothing (TenantBridge is fetching)
 * - 0 orgs → render nothing (account needs invite)
 * - 1 org → already auto-selected by TenantBridge
 * - 2+ orgs with none selected → call onRedirectToSelectOrg
 * - org selected → render children
 */
export function OrgGuard({ children, onRedirectToSelectOrg }: OrgGuardProps) {
  const { organizations, currentOrganization, ready } = useTenant();

  useEffect(() => {
    if (!ready) return;
    if (organizations.length <= 1) return;
    if (!currentOrganization) {
      onRedirectToSelectOrg();
    }
  }, [ready, organizations, currentOrganization, onRedirectToSelectOrg]);

  if (!ready) {
    return null;
  }

  if (organizations.length === 0) {
    return null;
  }

  if (organizations.length > 1 && !currentOrganization) {
    return null;
  }

  return <>{children}</>;
}
