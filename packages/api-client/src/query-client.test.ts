import { describe, expect, it, vi } from "vitest";

import { ApiError } from "./errors";
import { createQueryClient } from "./query-client";

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
