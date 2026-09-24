import { onlineManager, QueryClient } from "@tanstack/react-query";
import { describe, expect, it, vi } from "vitest";

import { ApiError } from "./errors";
import { cancelStaleRequests, createQueryClient } from "./query-client";

describe("createQueryClient", () => {
  it("reports an unauthorized query to the hook", async () => {
    const onUnauthorized = vi.fn();
    const client = createQueryClient({ onUnauthorized });

    await client
      .fetchQuery({
        queryKey: ["x"],
        queryFn: () => Promise.reject(new ApiError("no", { status: 401 })),
        retry: false,
      })
      .catch(() => {});

    expect(onUnauthorized).toHaveBeenCalledTimes(1);
  });

  it("stays silent for an ordinary failure", async () => {
    const onUnauthorized = vi.fn();
    const client = createQueryClient({ onUnauthorized });

    await client
      .fetchQuery({
        queryKey: ["x"],
        queryFn: () => Promise.reject(new ApiError("no", { status: 500 })),
        retry: false,
      })
      .catch(() => {});

    expect(onUnauthorized).not.toHaveBeenCalled();
  });

  it("reports an unauthorized mutation to the hook", async () => {
    const onUnauthorized = vi.fn();
    const client = createQueryClient({ onUnauthorized });

    await client
      .getMutationCache()
      .build(client, {
        mutationFn: () => Promise.reject(new ApiError("no", { code: "user_unauthorized" })),
      })
      .execute(undefined)
      .catch(() => {});

    expect(onUnauthorized).toHaveBeenCalledTimes(1);
  });

  it("does not evict a paused mutation when cancelMutations runs", async () => {
    const client = createQueryClient();
    onlineManager.setOnline(false);
    try {
      // Paused: networkMode "online" while offline, so it has not run yet.
      const paused = client.getMutationCache().build(client, {
        mutationFn: vi.fn().mockResolvedValue("ok"),
        networkMode: "online",
      });
      void paused.execute(undefined).catch(() => {});
      await vi.waitFor(() => expect(paused.state.isPaused).toBe(true));

      // Plain pending: networkMode "always" so it runs even while offline.
      const pendingFn = vi.fn(() => new Promise(() => {}));
      const pending = client.getMutationCache().build(client, {
        mutationFn: pendingFn,
        networkMode: "always",
      });
      void pending.execute(undefined).catch(() => {});
      await vi.waitFor(() => expect(pendingFn).toHaveBeenCalled());

      await client.cancelMutations();

      // A paused mutation is not stale — it never ran — so evicting it would
      // strand resumePausedMutations() and hang its mutateAsync() caller.
      expect(client.getMutationCache().getAll()).toContain(paused);
      expect(client.getMutationCache().getAll()).not.toContain(pending);
    } finally {
      onlineManager.setOnline(true);
    }
  });

  it("ignores an unauthorized mutation evicted by cancelMutations", async () => {
    const onUnauthorized = vi.fn();
    const client = createQueryClient({ onUnauthorized });

    let rejectMutation: (error: unknown) => void = () => {};
    const mutation = client.getMutationCache().build(client, {
      mutationFn: () => new Promise((_resolve, reject) => (rejectMutation = reject)),
    });
    const running = mutation.execute(undefined).catch(() => {});

    await vi.waitFor(() => expect(client.isMutating()).toBe(1));
    await client.cancelMutations();
    rejectMutation(new ApiError("no", { status: 401 }));
    await running;

    expect(onUnauthorized).not.toHaveBeenCalled();
  });
});

describe("cancelStaleRequests", () => {
  it("cancels queries and mutations on a cancellable client", async () => {
    const client = createQueryClient();
    const cancelQueries = vi.spyOn(client, "cancelQueries").mockResolvedValue();
    const cancelMutations = vi.spyOn(client, "cancelMutations").mockResolvedValue();

    await expect(cancelStaleRequests(client)).resolves.toBeUndefined();

    expect(cancelQueries).toHaveBeenCalledTimes(1);
    expect(cancelMutations).toHaveBeenCalledTimes(1);
  });

  it("still cancels queries for a plain QueryClient without cancelMutations", async () => {
    const client = new QueryClient();
    const cancelQueries = vi.spyOn(client, "cancelQueries").mockResolvedValue();

    await expect(cancelStaleRequests(client)).resolves.toBeUndefined();

    expect(cancelQueries).toHaveBeenCalledTimes(1);
  });
});
