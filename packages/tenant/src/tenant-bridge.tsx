"use client";

import { useAuth } from "@cdorneles/auth";
import type { Branding } from "@cdorneles/types";
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";

import { resolveActiveOrganization } from "./active-organization";
import { TenantProvider } from "./tenant-context";
import type { TenantService } from "./tenant-service";
import type { Organization } from "./types";

const STORAGE_KEY = "cdorneles-active-org";

function getPreferredOrganizationId(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

function persistOrganizationId(organizationId: string | null): void {
  if (typeof window === "undefined") return;
  try {
    if (organizationId) {
      localStorage.setItem(STORAGE_KEY, organizationId);
    } else {
      localStorage.removeItem(STORAGE_KEY);
    }
  } catch {
    /* storage unavailable */
  }
}

export interface TenantBridgeProps {
  tenantService: TenantService;
  children: ReactNode;
}

/**
 * Bridges AuthProvider and TenantProvider. After the user authenticates,
 * fetches organizations from Appwrite and feeds TenantProvider with the
 * resolved active organization.
 */
export function TenantBridge({ tenantService, children }: TenantBridgeProps) {
  const { user, status } = useAuth();
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [currentOrganizationId, setCurrentOrganizationId] = useState<string | null>(null);
  const [branding, setBranding] = useState<Branding | null>(null);
  const [ready, setReady] = useState(false);
  const bootstrapped = useRef(false);

  useEffect(() => {
    if (status !== "authenticated" || !user || bootstrapped.current) return;

    let cancelled = false;

    async function load() {
      const [orgs, memberships] = await Promise.all([
        tenantService.listOrganizations(),
        tenantService.listMemberships(user!.id),
      ]);

      if (cancelled) return;

      const preferred = getPreferredOrganizationId();
      const resolved = resolveActiveOrganization({
        organizations: orgs,
        memberships,
        preferredOrganizationId: preferred,
      });

      setOrganizations(orgs);

      if (resolved) {
        setCurrentOrganizationId(resolved.id);
        persistOrganizationId(resolved.id);
      } else if (orgs.length === 1) {
        setCurrentOrganizationId(orgs[0].id);
        persistOrganizationId(orgs[0].id);
      } else {
        setCurrentOrganizationId(null);
      }

      bootstrapped.current = true;
      setReady(true);
    }

    load();

    return () => {
      cancelled = true;
    };
  }, [status, user, tenantService]);

  useEffect(() => {
    if (!currentOrganizationId) {
      setBranding(null);
      return;
    }

    let cancelled = false;
    tenantService.getProfile(currentOrganizationId).then((result) => {
      if (!cancelled) setBranding(result);
    });

    return () => {
      cancelled = true;
    };
  }, [currentOrganizationId, tenantService]);

  const handleOrganizationChange = useCallback((organization: Organization) => {
    setCurrentOrganizationId(organization.id);
    persistOrganizationId(organization.id);
  }, []);

  const handleCreateOrganization = useCallback(
    async (name: string): Promise<Organization> => {
      const organization = await tenantService.createOrganization(name);
      const orgs = await tenantService.listOrganizations();
      setOrganizations(orgs);
      setCurrentOrganizationId(organization.id);
      persistOrganizationId(organization.id);
      return organization;
    },
    [tenantService],
  );

  return (
    <TenantProvider
      organizations={organizations}
      currentOrganizationId={currentOrganizationId}
      branding={branding}
      ready={ready}
      onOrganizationChange={handleOrganizationChange}
      onCreateOrganization={handleCreateOrganization}
    >
      {children}
    </TenantProvider>
  );
}
