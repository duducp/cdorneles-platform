import { QueryClient } from "@tanstack/react-query";

/**
 * Shared TanStack Query client (ARCHITECTURE §15). Apps create one instance
 * and provide it through `QueryClientProvider`.
 */
export function createQueryClient(): QueryClient {
  return new QueryClient({
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
