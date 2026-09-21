"use client";

import {
  createAppwriteServices,
  createQueryClient,
  resolveApiClientConfig,
  type FunctionsApi,
} from "@cdorneles/api-client";
import {
  AuthProvider,
  createAppwriteAuthService,
  createUnconfiguredAuthService,
  usePermissions,
} from "@cdorneles/auth";
import { TenantBridge, TenantProvider, createAppwriteTenantService, useTenant } from "@cdorneles/tenant";
import { ThemeProvider } from "@cdorneles/theme";
import type { TenantService } from "@cdorneles/tenant";
import { AppProvider } from "@cdorneles/ui";
import { AccessProvider } from "@cdorneles/ui/permissions";
import { useState, type ReactNode } from "react";

import { initObservability } from "@/lib/observability";

const APPLICATION_ID = "customer";

function ThemeBranding({ children }: { children: ReactNode }) {
  const { branding } = useTenant();
  return <ThemeProvider branding={branding}>{children}</ThemeProvider>;
}

function InnerProviders({
  children,
  functionsApi,
}: {
  children: ReactNode;
  functionsApi: FunctionsApi;
}) {
  const { currentOrganization } = useTenant();
  const { granted, status } = usePermissions(APPLICATION_ID, currentOrganization?.id, functionsApi);

  // Public routes (/login, recovery, /select-org) have no organization, so the
  // permissions query stays disabled and its status never leaves "loading".
  // Wait only while a query is actually in flight, otherwise those routes would
  // render nothing — the same trap OrgGuard had.
  if (currentOrganization && status === "loading") {
    return null;
  }

  return (
    <AccessProvider granted={granted ?? { permissions: [], features: [] }}>
      {children}
    </AccessProvider>
  );
}

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
    return createAppwriteTenantService(services.teams, services.functions);
  });
  const functionsApi = (() => {
    const endpoint = process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT;
    const projectId = process.env.NEXT_PUBLIC_APPWRITE_PROJECT_ID;
    if (!endpoint || !projectId) return null;
    const config = resolveApiClientConfig({ endpoint, projectId });
    const services = createAppwriteServices(config);
    return services.functions;
  })();

  initObservability();

  // OrgGuard lives in the (shell) layout, not here: public routes such as
  // /login must render for an unauthenticated visitor, and OrgGuard renders
  // nothing until TenantBridge has resolved an organization.
  const tenantContent = (
    <ThemeBranding>
      {functionsApi ? (
        <InnerProviders functionsApi={functionsApi}>{children}</InnerProviders>
      ) : (
        children
      )}
    </ThemeBranding>
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
