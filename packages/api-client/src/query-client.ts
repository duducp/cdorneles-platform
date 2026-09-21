import { MutationCache, QueryCache, QueryClient } from "@tanstack/react-query";

import { isUnauthorized } from "./errors";

export interface CreateQueryClientOptions {
  /**
   * Called when any query or mutation fails because the session is gone.
   *
   * Central on purpose: every request passes through these caches, so the
   * session-expired dialog appears no matter which call noticed it first.
   */
  onUnauthorized?: () => void;
}

/**
 * Shared TanStack Query client (ARCHITECTURE §15). Apps create one instance
 * and provide it through `QueryClientProvider`.
 */
export function createQueryClient(options: CreateQueryClientOptions = {}): QueryClient {
  const handleError = (error: unknown) => {
    if (isUnauthorized(error)) {
      options.onUnauthorized?.();
    }
  };

  return new QueryClient({
    queryCache: new QueryCache({ onError: handleError }),
    mutationCache: new MutationCache({ onError: handleError }),
    defaultOptions: {
      queries: {
        staleTime: 30_000,
        retry: 1,
        refetchOnWindowFocus: false,
      },
      mutations: {
        retry: 0,
      },
    },
  });
}
