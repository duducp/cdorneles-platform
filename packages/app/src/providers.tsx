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
import type { SentryLike } from "@cdorneles/observability";
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

import { IdleLockGate } from "./idle-lock-gate";
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
  const { currentOrganization, ready } = useTenant();
  // `undefined` while the tenant state is still resolving (permissions stay
  // disabled); `null` once resolved with no organization (platform grants).
  const organizationId = ready ? (currentOrganization?.id ?? null) : undefined;
  const { granted, status } = usePermissions(applicationId, organizationId, functionsApi);

  // Only blank the content while an existing organization's permissions are
  // still loading, otherwise public routes (/login, recovery, /select-org) with
  // no organization would render nothing — the same trap OrgGuard had.
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
  /**
   * The initialized `@sentry/nextjs` module, injected so the app owns the
   * dependency. Omit it (or leave `NEXT_PUBLIC_SENTRY_DSN` unset) to use the
   * noop provider.
   */
  observability?: SentryLike | null;
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
export function createProviders({ applicationId, observability }: CreateProvidersOptions) {
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

    initObservability(observability);

    const tenantContent = (
      <ThemeBranding>
        {functionsApi ? (
          <InnerProviders applicationId={applicationId} functionsApi={functionsApi}>
            {children}
          </InnerProviders>
        ) : (
          // No Appwrite config (e.g. a build without env): still provide the
          // access context so `PermissionGate`/`useAccess` render a deny state
          // instead of throwing.
          <AccessProvider granted={{ permissions: [], features: [] }}>{children}</AccessProvider>
        )}
      </ThemeBranding>
    );

    return (
      <AppProvider queryClient={queryClient} organizationDefault="light">
        <AuthProvider service={authService} sessionSignal={sessionSignal}>
          <AppNotifications />
          <SessionExpiryNotice />
          <SessionExpiredGate />
          <IdleLockGate />
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
