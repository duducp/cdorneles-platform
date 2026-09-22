import { AppwriteException, type Client } from "appwrite";
import type * as Appwrite from "appwrite";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ApiError } from "../errors";
import { createStorageApi } from "./storage";

const mocks = vi.hoisted(() => ({
  storage: {
    getFilePreview: vi.fn(),
    createFile: vi.fn(),
    deleteFile: vi.fn(),
    listFiles: vi.fn(),
    getFileDownload: vi.fn(),
    getFileView: vi.fn(),
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

const file = {
  $id: "f1",
  $createdAt: "2026-01-01T00:00:00.000Z",
  $updatedAt: "2026-01-01T00:00:00.000Z",
  bucketId: "b1",
  name: "logo.png",
  mimeType: "image/png",
  sizeOriginal: 1234,
};

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

    let caught: unknown;
    try {
      api.getFilePreviewUrl({ bucketId: "b1", fileId: "f1" });
    } catch (error) {
      caught = error;
    }

    expect(caught).toBeInstanceOf(ApiError);
    expect(caught).toMatchObject({ code: "file_not_found", status: 404 });
  });

  it("uploads a file and maps the SDK result", async () => {
    mocks.storage.createFile.mockResolvedValue(file);

    const api = createStorageApi(client);
    const upload = new File(["x"], "logo.png", { type: "image/png" });
    const result = await api.uploadFile({ bucketId: "b1", fileId: "f1", file: upload });

    expect(mocks.storage.createFile).toHaveBeenCalledWith({
      bucketId: "b1",
      fileId: "f1",
      file: upload,
    });
    expect(result).toEqual({
      $id: "f1",
      $createdAt: "2026-01-01T00:00:00.000Z",
      $updatedAt: "2026-01-01T00:00:00.000Z",
      bucketId: "b1",
      name: "logo.png",
      mimeType: "image/png",
      sizeOriginal: 1234,
    });
  });

  it("forwards file permissions when uploading", async () => {
    mocks.storage.createFile.mockResolvedValue(file);

    const api = createStorageApi(client);
    const upload = new File(["x"], "logo.png", { type: "image/png" });
    await api.uploadFile({
      bucketId: "b1",
      fileId: "f1",
      file: upload,
      permissions: ['read("team:org1")'],
    });

    expect(mocks.storage.createFile).toHaveBeenCalledWith({
      bucketId: "b1",
      fileId: "f1",
      file: upload,
      permissions: ['read("team:org1")'],
    });
  });

  it("wraps upload failures in ApiError", async () => {
    mocks.storage.createFile.mockRejectedValue(new AppwriteException("nope", 400, "file_invalid"));

    const api = createStorageApi(client);

    await expect(
      api.uploadFile({
        bucketId: "b1",
        fileId: "f1",
        file: new File(["x"], "logo.png", { type: "image/png" }),
      }),
    ).rejects.toMatchObject({ code: "file_invalid", status: 400 });
  });

  it("deletes a file", async () => {
    mocks.storage.deleteFile.mockResolvedValue(undefined);

    const api = createStorageApi(client);
    await api.deleteFile({ bucketId: "b1", fileId: "f1" });

    expect(mocks.storage.deleteFile).toHaveBeenCalledWith({ bucketId: "b1", fileId: "f1" });
  });

  it("wraps delete failures in ApiError", async () => {
    mocks.storage.deleteFile.mockRejectedValue(
      new AppwriteException("nope", 403, "file_forbidden"),
    );

    const api = createStorageApi(client);

    await expect(api.deleteFile({ bucketId: "b1", fileId: "f1" })).rejects.toMatchObject({
      code: "file_forbidden",
      status: 403,
    });
  });

  it("lists files and maps the SDK result", async () => {
    mocks.storage.listFiles.mockResolvedValue({ total: 1, files: [file] });

    const api = createStorageApi(client);
    const result = await api.listFiles({ bucketId: "b1", queries: ["limit(10)"] });

    expect(mocks.storage.listFiles).toHaveBeenCalledWith({
      bucketId: "b1",
      queries: ["limit(10)"],
    });
    expect(result).toEqual([
      {
        $id: "f1",
        $createdAt: "2026-01-01T00:00:00.000Z",
        $updatedAt: "2026-01-01T00:00:00.000Z",
        bucketId: "b1",
        name: "logo.png",
        mimeType: "image/png",
        sizeOriginal: 1234,
      },
    ]);
  });

  it("wraps list failures in ApiError", async () => {
    mocks.storage.listFiles.mockRejectedValue(new AppwriteException("nope", 500, "general_error"));

    const api = createStorageApi(client);

    await expect(api.listFiles({ bucketId: "b1" })).rejects.toMatchObject({
      code: "general_error",
      status: 500,
    });
  });

  it("returns the file download url", () => {
    mocks.storage.getFileDownload.mockReturnValue("https://appwrite.example/download");

    const api = createStorageApi(client);
    const url = api.getFileDownloadUrl({ bucketId: "b1", fileId: "f1" });

    expect(mocks.storage.getFileDownload).toHaveBeenCalledWith({ bucketId: "b1", fileId: "f1" });
    expect(url).toBe("https://appwrite.example/download");
  });

  it("wraps download url failures in ApiError", () => {
    mocks.storage.getFileDownload.mockImplementation(() => {
      throw new AppwriteException("nope", 404, "file_not_found");
    });

    const api = createStorageApi(client);

    let caught: unknown;
    try {
      api.getFileDownloadUrl({ bucketId: "b1", fileId: "f1" });
    } catch (error) {
      caught = error;
    }

    expect(caught).toBeInstanceOf(ApiError);
    expect(caught).toMatchObject({ code: "file_not_found", status: 404 });
  });

  it("returns the file view url", () => {
    mocks.storage.getFileView.mockReturnValue("https://appwrite.example/view");

    const api = createStorageApi(client);
    const url = api.getFileViewUrl({ bucketId: "b1", fileId: "f1" });

    expect(mocks.storage.getFileView).toHaveBeenCalledWith({ bucketId: "b1", fileId: "f1" });
    expect(url).toBe("https://appwrite.example/view");
  });

  it("wraps view url failures in ApiError", () => {
    mocks.storage.getFileView.mockImplementation(() => {
      throw new AppwriteException("nope", 403, "file_forbidden");
    });

    const api = createStorageApi(client);

    let caught: unknown;
    try {
      api.getFileViewUrl({ bucketId: "b1", fileId: "f1" });
    } catch (error) {
      caught = error;
    }

    expect(caught).toBeInstanceOf(ApiError);
    expect(caught).toMatchObject({ code: "file_forbidden", status: 403 });
  });
});
