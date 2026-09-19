import { describe, it, expect, vi, beforeEach } from "vitest";

const mockCreateBucket = vi.fn().mockResolvedValue({ $id: "test" });

vi.mock("node-appwrite", () => {
  return {
    Client: vi.fn().mockImplementation(function () {
      return {
        setEndpoint: vi.fn().mockReturnThis(),
        setProject: vi.fn().mockReturnThis(),
        setKey: vi.fn().mockReturnThis(),
      };
    }),
    Storage: vi.fn().mockImplementation(function () {
      return { createBucket: mockCreateBucket };
    }),
  };
});

import { createBuckets } from "../buckets.js";
import type { AppwriteConfig } from "../client.js";

describe("createBuckets", () => {
  const config: AppwriteConfig = {
    endpoint: "https://test.appwrite.io/v1",
    projectId: "test-project",
    apiKey: "test-api-key",
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockCreateBucket.mockResolvedValue({ $id: "test" });
  });

  it("is a function", () => {
    expect(typeof createBuckets).toBe("function");
  });

  it("creates all 3 buckets", async () => {
    await createBuckets(config);

    expect(mockCreateBucket).toHaveBeenCalledTimes(3);
  });

  it("creates each bucket with its configured size and extensions", async () => {
    await createBuckets(config);

    expect(mockCreateBucket).toHaveBeenNthCalledWith(
      1,
      "branding-logos",
      "Branding Logos",
      [],
      true,
      true,
      5 * 1024 * 1024,
      ["png", "jpg", "jpeg", "svg", "webp"],
    );
    expect(mockCreateBucket).toHaveBeenNthCalledWith(
      2,
      "documents",
      "Documents",
      [],
      true,
      true,
      50 * 1024 * 1024,
      ["pdf", "txt", "csv", "doc", "docx", "xls", "xlsx", "png", "jpg", "jpeg", "webp"],
    );
    expect(mockCreateBucket).toHaveBeenNthCalledWith(
      3,
      "avatars",
      "Avatars",
      [],
      true,
      true,
      2 * 1024 * 1024,
      ["png", "jpg", "jpeg", "webp"],
    );
  });

  it("creates the expected bucket ids in order", async () => {
    await createBuckets(config);

    expect(mockCreateBucket.mock.calls.map((call) => call[0])).toEqual([
      "branding-logos",
      "documents",
      "avatars",
    ]);
  });

  it("handles 409 conflict (bucket already exists)", async () => {
    mockCreateBucket.mockRejectedValueOnce({ code: 409 });

    await expect(createBuckets(config)).resolves.not.toThrow();
  });

  it("propagates non-409 errors", async () => {
    mockCreateBucket.mockRejectedValue({ code: 500 });

    await expect(createBuckets(config)).rejects.toThrow();
  });
});
