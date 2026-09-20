"use client";

import { resolveGrants, type GrantedAccess } from "@cdorneles/permissions";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect } from "react";

import { useAuth } from "./auth-context";

export interface UsePermissionsResult {
  granted: GrantedAccess | null;
  status: "loading" | "resolved" | "error";
  refresh: () => Promise<void>;
}

/**
 * Loads the user's effective permissions and features for the active
 * organization and current application. Uses TanStack Query for caching
 * and automatic re-fetch on organization change.
 */
export function usePermissions(
  applicationId: string,
  organizationId: string | null | undefined,
): UsePermissionsResult {
  const { user, status: authStatus, service } = useAuth();
  const queryClient = useQueryClient();

  const enabled = authStatus === "authenticated" && !!user && !!organizationId;

  const query = useQuery({
    queryKey: ["grants", user?.id, organizationId, applicationId],
    queryFn: async (): Promise<GrantedAccess> => {
      return resolveGrants(service as any, {
        userId: user!.id,
        organizationId: organizationId!,
        applicationId,
      });
    },
    enabled,
    staleTime: 5 * 60 * 1000,
    retry: 1,
  });

  // Invalidate when organization changes
  useEffect(() => {
    if (enabled) {
      queryClient.invalidateQueries({ queryKey: ["grants", user?.id] });
    }
  }, [organizationId, enabled, queryClient, user?.id]);

  const refresh = useCallback(async () => {
    await queryClient.invalidateQueries({ queryKey: ["grants"] });
  }, [queryClient]);

  const status = !enabled
    ? "loading"
    : query.isError
      ? "error"
      : query.isSuccess
        ? "resolved"
        : "loading";

  return {
    granted: query.data ?? null,
    status,
    refresh,
  };
}
