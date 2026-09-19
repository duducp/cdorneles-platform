"use client";

import {
  createAppwriteServices,
  createQueryClient,
  resolveApiClientConfig,
} from "@cdorneles/api-client";
import { AuthProvider, createAppwriteAuthService } from "@cdorneles/auth";
import { TenantProvider } from "@cdorneles/tenant";
import { AppProvider } from "@cdorneles/ui";
import { AccessProvider } from "@cdorneles/ui/permissions";
import { useState, type ReactNode } from "react";

import { initObservability } from "@/lib/observability";

export function Providers({ children }: { children: ReactNode }) {
  const [queryClient] = useState(() => createQueryClient());
  const [authService] = useState(() => {
    const config = resolveApiClientConfig({
      endpoint: process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT,
      projectId: process.env.NEXT_PUBLIC_APPWRITE_PROJECT_ID,
    });
    const services = createAppwriteServices(config);
    return createAppwriteAuthService(services.account);
  });

  initObservability();

  return (
    <AppProvider queryClient={queryClient} organizationDefault="light">
      <AuthProvider service={authService}>
        <TenantProvider>
          <AccessProvider granted={{ permissions: [], features: [] }}>{children}</AccessProvider>
        </TenantProvider>
      </AuthProvider>
    </AppProvider>
  );
}
