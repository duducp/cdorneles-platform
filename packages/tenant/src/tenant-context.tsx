"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

import type { Branding } from "@cdorneles/types";

import type { Organization } from "./types";

export interface TenantContextValue {
  currentOrganization: Organization | null;
  organizations: Organization[];
  branding: Branding | null;
  /** Whether TenantBridge has finished fetching organizations. */
  ready: boolean;
  /** Switches organization. Returns `false` for unknown/untrusted ids. */
  switchOrganization: (organizationId: string) => boolean;
  /** Creates an organization and makes it active. */
  createOrganization: (name: string) => Promise<Organization>;
}

export const TenantContext = createContext<TenantContextValue | null>(null);

export interface TenantProviderProps {
  organizations?: Organization[];
  /** Initial organization id. Falls back to the first organization. */
  currentOrganizationId?: string | null;
  branding?: Branding | null;
  /** Whether the tenant data has been loaded. */
  ready?: boolean;
  onOrganizationChange?: (organization: Organization) => void;
  onCreateOrganization?: (name: string) => Promise<Organization>;
  children: ReactNode;
}

/**
 * Holds the active organization context. Organization identity ultimately
 * comes from trusted Appwrite Team membership, not from client input.
 */
export function TenantProvider({
  organizations = [],
  currentOrganizationId = null,
  branding = null,
  ready = true,
  onOrganizationChange,
  onCreateOrganization,
  children,
}: TenantProviderProps) {
  const [selectedId, setSelectedId] = useState<string | null>(
    currentOrganizationId ?? organizations[0]?.id ?? null,
  );

  useEffect(() => {
    if (currentOrganizationId) {
      setSelectedId(currentOrganizationId);
    }
  }, [currentOrganizationId]);

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

  const createOrganization = useCallback(
    async (name: string) => {
      if (!onCreateOrganization) {
        throw new Error("createOrganization is not configured.");
      }
      return onCreateOrganization(name);
    },
    [onCreateOrganization],
  );

  const value = useMemo<TenantContextValue>(
    () => ({
      currentOrganization,
      organizations,
      branding,
      ready,
      switchOrganization,
      createOrganization,
    }),
    [currentOrganization, organizations, branding, ready, switchOrganization, createOrganization],
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
