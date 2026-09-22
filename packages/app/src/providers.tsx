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
  createSessionSignal,
  createUnconfiguredAuthService,
  usePermissions,
} from "@cdorneles/auth";
import {
  TenantBridge,
  TenantProvider,
  createAppwriteTenantService,
  useTenant,
  type TenantService,
} from "@cdorneles/tenant";
import { ThemeProvider } from "@cdorneles/theme";
import { AppNotifications, AppProvider } from "@cdorneles/ui";
import { AccessProvider } from "@cdorneles/ui/permissions";
import { useState, type ReactNode } from "react";

import { initObservability } from "./observability";
import { SessionExpiredGate } from "./session-expired-gate";
import { SessionExpiryNotice } from "./session-expiry-notice";

function ThemeBranding({ children }: { children: ReactNode }) {
  const { branding } = useTenant();
  return <ThemeProvider branding={branding}>{children}</ThemeProvider>;
}

function InnerProviders({
  children,
  applicationId,
  functionsApi,
}: {
  children: ReactNode;
  applicationId: string;
  functionsApi: FunctionsApi;
}) {
  const { currentOrganization } = useTenant();
  const { granted, status } = usePermissions(applicationId, currentOrganization?.id, functionsApi);

  // Public routes (/login, recovery, /select-org) have no organization, so the
  // permissions query stays disabled and its status never leaves "loading".
  // Wait only while a query is actually in flight, otherwise those routes
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

export interface CreateProvidersOptions {
  /**
   * The application this deployment serves (`admin`, `client`).
   * Permissions are resolved for it, so a role only grants what the
   * application is allowed to use.
   */
  applicationId: string;
}

/**
 * Builds the provider tree shared by the product apps: Appwrite auth, the
 * tenant bridge, organization branding, and the effective permissions of the
 * active organization for this application.
 *
 * OrgGuard is deliberately absent — it belongs in the `(shell)` layout.
 * Mounting it here would gate the public routes too, and since TenantBridge
 * only resolves once authenticated, an anonymous visitor would get a blank
 * page instead of the login form.
 */
export function createProviders({ applicationId }: CreateProvidersOptions) {
  return function Providers({ children }: { children: ReactNode }) {
    const [sessionSignal] = useState(() => createSessionSignal());
    const [queryClient] = useState(() =>
      createQueryClient({ onUnauthorized: () => sessionSignal.notifyExpired() }),
    );
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

    const tenantContent = (
      <ThemeBranding>
        {functionsApi ? (
          <InnerProviders applicationId={applicationId} functionsApi={functionsApi}>
            {children}
          </InnerProviders>
        ) : (
          children
        )}
      </ThemeBranding>
    );

    return (
      <AppProvider queryClient={queryClient} organizationDefault="light">
        <AuthProvider service={authService} sessionSignal={sessionSignal}>
          <AppNotifications />
          <SessionExpiryNotice />
          <SessionExpiredGate />
          {tenantService ? (
            <TenantBridge tenantService={tenantService}>{tenantContent}</TenantBridge>
          ) : (
            <TenantProvider>{tenantContent}</TenantProvider>
          )}
        </AuthProvider>
      </AppProvider>
    );
  };
}
