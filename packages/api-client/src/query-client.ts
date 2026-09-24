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
export function createQueryClient(options: CreateQueryClientOptions = {}): CancellableQueryClient {
  const handleError = (error: unknown) => {
    if (isUnauthorized(error)) {
      options.onUnauthorized?.();
    }
  };

  // Mutable holder: the MutationCache onError below must see the finished
  // client, but the cache is built while `queryClient` is still initializing.
  const clientRef: { current: CancellableQueryClient | undefined } = { current: undefined };

  const queryClient = new QueryClient({
    queryCache: new QueryCache({ onError: handleError }),
    mutationCache: new MutationCache({
      onError: (error, _variables, _context, mutation) => {
        // A mutation evicted by cancelMutations() is stale: its 401 belongs to
        // the session that already expired, not the one that replaced it.
        if (
          !clientRef.current
            ?.getMutationCache()
            .getAll()
            .some((m) => m === mutation)
        )
          return;
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

  clientRef.current = queryClient;

  queryClient.cancelMutations = async () => {
    const cache = queryClient.getMutationCache();
    for (const mutation of cache.getAll()) {
      // A paused mutation (offline, networkMode "online") never ran, so it is
      // not a stale 401 source: evicting it would leave resumePausedMutations()
      // with nothing to resume and hang the mutateAsync() caller.
      if (mutation.state.status === "pending" && !mutation.state.isPaused) {
        cache.remove(mutation);
      }
    }
  };

  return queryClient;
}

/**
 * Cancels the work that belongs to the session that just died: every in-flight
 * query, plus any pending mutation the client can cancel.
 *
 * `cancelMutations` is an extension added by `createQueryClient`, not part of
 * the base `QueryClient`, so callers can pass any client and the mutation
 * cancellation is guarded at runtime instead of casting at each call site.
 * Both cancels settle before the returned promise resolves, so a caller can
 * re-authenticate only once they are done.
 */
export async function cancelStaleRequests(queryClient: QueryClient): Promise<void> {
  const cancelMutations = (queryClient as Partial<CancellableQueryClient>).cancelMutations;
  await Promise.all([
    queryClient.cancelQueries(),
    typeof cancelMutations === "function" ? cancelMutations.call(queryClient) : Promise.resolve(),
  ]);
}
