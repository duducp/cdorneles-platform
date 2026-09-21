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
import { OrgGuard, TenantBridge, TenantProvider, createAppwriteTenantService, useTenant } from "@cdorneles/tenant";
import type { TenantService } from "@cdorneles/tenant";
import { AppProvider } from "@cdorneles/ui";
import { AccessProvider } from "@cdorneles/ui/permissions";
import { useRouter } from "next/navigation";
import { useCallback, useState, type ReactNode } from "react";

import { initObservability } from "@/lib/observability";

const APPLICATION_ID = "client";

function InnerProviders({
  children,
  functionsApi,
}: {
  children: ReactNode;
  functionsApi: FunctionsApi;
}) {
  const { currentOrganization } = useTenant();
  const { granted, status } = usePermissions(APPLICATION_ID, currentOrganization?.id, functionsApi);

  return (
    <AccessProvider granted={granted ?? { permissions: [], features: [] }}>
      {status === "loading" ? null : children}
    </AccessProvider>
  );
}

export function Providers({ children }: { children: ReactNode }) {
  const router = useRouter();
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

  const handleRedirectToSelectOrg = useCallback(() => {
    router.replace("/select-org");
  }, [router]);

  const tenantContent = (
    <OrgGuard onRedirectToSelectOrg={handleRedirectToSelectOrg}>
      {functionsApi ? (
        <InnerProviders functionsApi={functionsApi}>{children}</InnerProviders>
      ) : (
        children
      )}
    </OrgGuard>
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
