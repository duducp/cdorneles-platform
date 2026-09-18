"use client";

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";

import type { Organization } from "./types";

export interface TenantContextValue {
  currentOrganization: Organization | null;
  organizations: Organization[];
  /** Switches organization. Returns `false` for unknown/untrusted ids. */
  switchOrganization: (organizationId: string) => boolean;
}

const TenantContext = createContext<TenantContextValue | null>(null);

export interface TenantProviderProps {
  organizations?: Organization[];
  /** Initial organization id. Falls back to the first organization. */
  currentOrganizationId?: string | null;
  onOrganizationChange?: (organization: Organization) => void;
  children: ReactNode;
}

/**
 * Holds the active organization context. Organization identity ultimately
 * comes from trusted Appwrite Team membership, not from client input.
 */
export function TenantProvider({
  organizations = [],
  currentOrganizationId = null,
  onOrganizationChange,
  children,
}: TenantProviderProps) {
  const [selectedId, setSelectedId] = useState<string | null>(
    currentOrganizationId ?? organizations[0]?.id ?? null,
  );

  const currentOrganization = useMemo(
    () => organizations.find((organization) => organization.id === selectedId) ?? null,
    [organizations, selectedId],
  );

  const switchOrganization = useCallback(
    (organizationId: string) => {
      const next = organizations.find((organization) => organization.id === organizationId);
      if (!next) {
        return false;
      }
      setSelectedId(organizationId);
      onOrganizationChange?.(next);
      return true;
    },
    [organizations, onOrganizationChange],
  );

  const value = useMemo<TenantContextValue>(
    () => ({ currentOrganization, organizations, switchOrganization }),
    [currentOrganization, organizations, switchOrganization],
  );

  return <TenantContext.Provider value={value}>{children}</TenantContext.Provider>;
}

export function useTenant(): TenantContextValue {
  const context = useContext(TenantContext);
  if (!context) {
    throw new Error("useTenant must be used within <TenantProvider>.");
  }
  return context;
}
