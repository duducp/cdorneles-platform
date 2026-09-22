import { MutationCache, QueryCache, QueryClient } from "@tanstack/react-query";

import { isUnauthorized } from "./errors";

export interface CreateQueryClientOptions {
  /**
   * Called when any query or mutation fails because the session is gone.
   *
   * Must be synchronous and must not throw — the QueryCache/MutationCache
   * onError hook runs inside TanStack Query internals.
   */
  onUnauthorized?: () => void;
}

/**
 * Shared TanStack Query client (ARCHITECTURE §15). Apps create one instance
 * and provide it through `QueryClientProvider`.
 *
 * Without `onUnauthorized`, unauthorized errors are silently ignored (they
 * still appear in the query cache as failed). With the option, a single
 * callback is invoked for every 401 across all queries and mutations.
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
