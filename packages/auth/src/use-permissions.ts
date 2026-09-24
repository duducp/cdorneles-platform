"use client";

import type { FunctionsApi } from "@cdorneles/api-client";
import { resolveGrants, type GrantedAccess } from "@cdorneles/permissions";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useRef } from "react";

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
 *
 * `organizationId` distinguishes three states:
 * - `undefined` — the tenant state is still loading; the query stays disabled.
 * - `null` — the tenant is resolved and the user has no organization; grants
 *   are resolved in platform mode (an empty organizationId).
 * - a string — grants are resolved for that organization.
 */
export function usePermissions(
  applicationId: string,
  organizationId: string | null | undefined,
  functionsApi: FunctionsApi,
): UsePermissionsResult {
  const { user, status: authStatus } = useAuth();
  const queryClient = useQueryClient();

  // A user with no active organization still resolves platform grants, but
  // only once the tenant state is resolved: `undefined` means "not resolved
  // yet", while `null` means "resolved, no organization".
  const enabled = authStatus === "authenticated" && !!user && organizationId !== undefined;

  const query = useQuery({
    queryKey: ["grants", user?.id, organizationId, applicationId],
    queryFn: async (): Promise<GrantedAccess> => {
      return resolveGrants(functionsApi, {
        userId: user!.id,
        organizationId: organizationId ?? "",
        applicationId,
      });
    },
    enabled,
    staleTime: 5 * 60 * 1000,
    retry: 1,
  });

  // Track the organization that was last resolved. The query key already
  // carries the organization, so a change refetches on its own; invalidating
  // here only exists to drop the previous organization's cached grants. Doing
  // it on mount would fire an extra invalidate/refetch of the first load.
  const previousOrganizationIdRef = useRef<string | null | undefined>(undefined);

  // Invalidate when organization changes
  useEffect(() => {
    const previous = previousOrganizationIdRef.current;
    previousOrganizationIdRef.current = organizationId;
    if (enabled && previous !== undefined && previous !== organizationId) {
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
