import { AppwriteException, type Client } from "appwrite";
import type * as Appwrite from "appwrite";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ApiError } from "../errors";
import { createFunctionsApi } from "./functions";

const mocks = vi.hoisted(() => ({
  functions: {
    createExecution: vi.fn(),
  },
}));

vi.mock("appwrite", async (importOriginal) => {
  const actual = await importOriginal<typeof Appwrite>();
  return {
    ...actual,
    Functions: vi.fn(function Functions() {
      return mocks.functions;
    }),
  };
});

const client = {} as Client;

beforeEach(() => {
  vi.clearAllMocks();
});

describe("createFunctionsApi", () => {
  it("maps an execution and forwards the request", async () => {
    mocks.functions.createExecution.mockResolvedValue({
      $id: "e1",
      $createdAt: "2026-01-01T00:00:00.000Z",
      $updatedAt: "2026-01-01T00:00:00.000Z",
      $permissions: ['read("any")'],
      status: "completed",
      responseBody: '{"ok":true}',
      logs: "stdout",
      errors: "",
      duration: 12.5,
    });

    const api = createFunctionsApi(client);
    const execution = await api.createExecution({
      functionId: "fn1",
      body: '{"x":1}',
      path: "/run",
      method: "POST",
    });

    expect(mocks.functions.createExecution).toHaveBeenCalledWith({
      functionId: "fn1",
      body: '{"x":1}',
      async: false,
      xpath: "/run",
      method: "POST",
    });
    expect(execution).toEqual({
      $id: "e1",
      status: "completed",
      responseBody: '{"ok":true}',
    });
    expect(execution).not.toHaveProperty("logs");
    expect(execution).not.toHaveProperty("duration");
  });

  it("wraps failures in ApiError", async () => {
    mocks.functions.createExecution.mockRejectedValue(
      new AppwriteException("nope", 401, "user_unauthorized"),
    );

    const api = createFunctionsApi(client);

    await expect(api.createExecution({ functionId: "fn1" })).rejects.toBeInstanceOf(ApiError);
  });
});
