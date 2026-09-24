"use client";

import { useAuth } from "@cdorneles/auth";
import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef } from "react";

/**
 * Clears the query cache whenever the authenticated user changes, so a
 * different account can never read data cached for the previous one. A
 * re-auth of the SAME user leaves the cache intact (a normal refetch).
 */
export function UserCacheGuard() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const previousUserIdRef = useRef<string | null>(null);

  useEffect(() => {
    const id = user?.id ?? null;
    if (previousUserIdRef.current !== null && previousUserIdRef.current !== id) {
      queryClient.clear();
    }
    previousUserIdRef.current = id;
  }, [user?.id, queryClient]);

  return null;
}
