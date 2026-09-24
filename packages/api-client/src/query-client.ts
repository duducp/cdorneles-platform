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
 * A query client that can also drop in-flight mutations.
 *
 * TanStack Query v5 has no mutation cancellation (mutations are side effects,
 * not abortable), but the session-expired gate must discard stale mutation
 * 401s before it re-authenticates. `cancelMutations` evicts every pending
 * mutation; the guarded `mutationCache.onError` below then ignores 401s from
 * mutations no longer in the cache, so a stale mutation can no longer re-expire
 * a freshly restored session.
 */
export interface CancellableQueryClient extends QueryClient {
  cancelMutations(): Promise<void>;
}

/**
 * Shared TanStack Query client (ARCHITECTURE §15). Apps create one instance
 * and provide it through `QueryClientProvider`.
 *
 * Without `onUnauthorized`, unauthorized errors are silently ignored (they
 * still appear in the query cache as failed). With the option, a single
 * callback is invoked for every 401 across all queries and mutations.
 */
export function createQueryClient(
  options: CreateQueryClientOptions = {},
): CancellableQueryClient {
  const handleError = (error: unknown) => {
    if (isUnauthorized(error)) {
      options.onUnauthorized?.();
    }
  };

  let client: CancellableQueryClient | undefined;

  const queryClient = new QueryClient({
    queryCache: new QueryCache({ onError: handleError }),
    mutationCache: new MutationCache({
      onError: (error, _variables, _context, mutation) => {
        // A mutation evicted by cancelMutations() is stale: its 401 belongs to
        // the session that already expired, not the one that replaced it.
        if (!client?.getMutationCache().getAll().some((m) => m === mutation)) return;
        handleError(error);
      },
    }),
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
  }) as CancellableQueryClient;

  client = queryClient;

  queryClient.cancelMutations = async () => {
    const cache = queryClient.getMutationCache();
    for (const mutation of cache.getAll()) {
      if (mutation.state.status === "pending") {
        cache.remove(mutation);
      }
    }
  };

  return queryClient;
}
