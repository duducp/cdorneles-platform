"use client";

import {
  createAppwriteServices,
  createQueryClient,
  resolveApiClientConfig,
} from "@cdorneles/api-client";
import {
  AuthProvider,
  createAppwriteAuthService,
  createUnconfiguredAuthService,
} from "@cdorneles/auth";
import { TenantBridge, TenantProvider, createAppwriteTenantService } from "@cdorneles/tenant";
import type { TenantService } from "@cdorneles/tenant";
import { AppProvider } from "@cdorneles/ui";
import { AccessProvider } from "@cdorneles/ui/permissions";
import { useState, type ReactNode } from "react";

import { initObservability } from "@/lib/observability";

export function Providers({ children }: { children: ReactNode }) {
  const [queryClient] = useState(() => createQueryClient());
  const [authService] = useState(() => {
    const endpoint = process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT;
    const projectId = process.env.NEXT_PUBLIC_APPWRITE_PROJECT_ID;
    if (!endpoint || !projectId) return createUnconfiguredAuthService();
    const config = resolveApiClientConfig({ endpoint, projectId });
    const services = createAppwriteServices(config);
    return createAppwriteAuthService(services.account);
  });
  const [tenantService] = useState<TenantService | null>(() => {
    const endpoint = process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT;
    const projectId = process.env.NEXT_PUBLIC_APPWRITE_PROJECT_ID;
    if (!endpoint || !projectId) return null;
    const config = resolveApiClientConfig({ endpoint, projectId });
    const services = createAppwriteServices(config);
    return createAppwriteTenantService(services.teams);
  });

  initObservability();

  const tenantContent = (
    <AccessProvider granted={{ permissions: [], features: [] }}>{children}</AccessProvider>
  );

  return (
    <AppProvider queryClient={queryClient} organizationDefault="light">
      <AuthProvider service={authService}>
        {tenantService ? (
          <TenantBridge tenantService={tenantService}>{tenantContent}</TenantBridge>
        ) : (
          <TenantProvider>{tenantContent}</TenantProvider>
        )}
      </AuthProvider>
    </AppProvider>
  );
}
