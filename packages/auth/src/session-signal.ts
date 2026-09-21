export interface SessionSignal {
  /** Announces that the session is gone. */
  notifyExpired(): void;
  /** Registers a listener; returns the unsubscribe function. */
  subscribe(listener: () => void): () => void;
  /** Removes every listener. Intended for tests and teardown. */
  unsubscribeAll(): void;
}

/**
 * A one-way channel from the query client to the auth provider.
 *
 * `QueryClient` is created before `AuthProvider` in the provider tree, so a
 * 401 seen by TanStack cannot reach the auth state through props. This carries
 * the signal instead, with no React or Appwrite dependency.
 */
export function createSessionSignal(): SessionSignal {
  const listeners = new Set<() => void>();

  return {
    notifyExpired() {
      // Copy before iterating: a listener may unsubscribe during the call.
      for (const listener of [...listeners]) {
        listener();
      }
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    unsubscribeAll() {
      listeners.clear();
    },
  };
}
