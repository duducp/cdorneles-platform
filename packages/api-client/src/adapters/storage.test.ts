import { AppwriteException, type Client } from "appwrite";
import type * as Appwrite from "appwrite";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ApiError } from "../errors";
import { createStorageApi } from "./storage";

const mocks = vi.hoisted(() => ({
  storage: {
    getFilePreview: vi.fn(),
  },
}));

vi.mock("appwrite", async (importOriginal) => {
  const actual = await importOriginal<typeof Appwrite>();
  return {
    ...actual,
    Storage: vi.fn(function Storage() {
      return mocks.storage;
    }),
  };
});

const client = {} as Client;

beforeEach(() => {
  vi.clearAllMocks();
});

describe("createStorageApi", () => {
  it("returns the file preview url", () => {
    mocks.storage.getFilePreview.mockReturnValue("https://appwrite.example/preview.png");

    const api = createStorageApi(client);
    const url = api.getFilePreviewUrl({ bucketId: "b1", fileId: "f1", width: 64, height: 64 });

    expect(mocks.storage.getFilePreview).toHaveBeenCalledWith({
      bucketId: "b1",
      fileId: "f1",
      width: 64,
      height: 64,
    });
    expect(url).toBe("https://appwrite.example/preview.png");
  });

  it("returns the file preview url without dimensions", () => {
    mocks.storage.getFilePreview.mockReturnValue("https://appwrite.example/preview.png");

    const api = createStorageApi(client);
    const url = api.getFilePreviewUrl({ bucketId: "b1", fileId: "f1" });

    expect(mocks.storage.getFilePreview).toHaveBeenCalledWith({
      bucketId: "b1",
      fileId: "f1",
      width: undefined,
      height: undefined,
    });
    expect(url).toBe("https://appwrite.example/preview.png");
  });

  it("wraps failures in ApiError", () => {
    mocks.storage.getFilePreview.mockImplementation(() => {
      throw new AppwriteException("nope", 404, "file_not_found");
    });

    const api = createStorageApi(client);

    expect(() => api.getFilePreviewUrl({ bucketId: "b1", fileId: "f1" })).toThrow(ApiError);
  });
});
