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
import {
  TenantBridge,
  TenantProvider,
  createAppwriteTenantService,
  useTenant,
} from "@cdorneles/tenant";
import { ThemeProvider } from "@cdorneles/theme";
import type { TenantService } from "@cdorneles/tenant";
import { AppNotifications, AppProvider } from "@cdorneles/ui";
import { useState, type ReactNode } from "react";

import { initObservability } from "@/lib/observability";

function ThemeBranding({ children }: { children: ReactNode }) {
  const { branding } = useTenant();
  return <ThemeProvider branding={branding}>{children}</ThemeProvider>;
}

/**
 * The design-system app is a visual playground, not an authenticated
 * application: pages must render without Appwrite credentials or a session.
 * Auth/tenant services stay wired so the demo pages can call useAuth/useTenant.
 */
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

  initObservability();

  return (
    <AppProvider queryClient={queryClient} organizationDefault="light">
      <AuthProvider service={authService}>
        <AppNotifications />
        {tenantService ? (
          <TenantBridge tenantService={tenantService}>
            <ThemeBranding>{children}</ThemeBranding>
          </TenantBridge>
        ) : (
          <TenantProvider>
            <ThemeBranding>{children}</ThemeBranding>
          </TenantProvider>
        )}
      </AuthProvider>
    </AppProvider>
  );
}
