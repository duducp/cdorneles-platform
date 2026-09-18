"use client";

import { createQueryClient } from "@cdorneles/api-client";
import { AuthProvider, createUnconfiguredAuthService } from "@cdorneles/auth";
import { TenantProvider } from "@cdorneles/tenant";
import { AppProvider } from "@cdorneles/ui";
import { AccessProvider } from "@cdorneles/ui/permissions";
import { useState, type ReactNode } from "react";

import { initObservability } from "@/lib/observability";

export function Providers({ children }: { children: ReactNode }) {
  const [queryClient] = useState(() => createQueryClient());
  const [authService] = useState(() => createUnconfiguredAuthService());

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
