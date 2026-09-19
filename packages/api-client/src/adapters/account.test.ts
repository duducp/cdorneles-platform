import { AppwriteException, type Client } from "appwrite";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ApiError } from "../errors";
import { createAccountApi } from "./account";

const mocks = vi.hoisted(() => ({
  account: {
    get: vi.fn(),
    listSessions: vi.fn(),
    createEmailPasswordSession: vi.fn(),
    deleteSession: vi.fn(),
  },
}));

vi.mock("appwrite", async (importOriginal) => {
  const actual = await importOriginal<typeof import("appwrite")>();
  return {
    ...actual,
    Account: vi.fn(function Account() {
      return mocks.account;
    }),
  };
});

const client = {} as Client;

beforeEach(() => {
  vi.clearAllMocks();
});

describe("createAccountApi", () => {
  it("maps the current user", async () => {
    mocks.account.get.mockResolvedValue({
      $id: "u1",
      email: "a@b.c",
      name: "Ada",
      status: true,
    });

    const api = createAccountApi(client);

    await expect(api.getCurrentUser()).resolves.toEqual({
      $id: "u1",
      email: "a@b.c",
      name: "Ada",
      status: true,
    });
  });

  it("maps sessions", async () => {
    mocks.account.listSessions.mockResolvedValue({
      sessions: [{ $id: "s1", userId: "u1", expire: "2026-01-01T00:00:00.000Z" }],
    });

    const api = createAccountApi(client);

    await expect(api.listSessions()).resolves.toEqual([
      { $id: "s1", userId: "u1", expire: "2026-01-01T00:00:00.000Z" },
    ]);
  });

  it("creates an email/password session with the given credentials", async () => {
    mocks.account.createEmailPasswordSession.mockResolvedValue({
      $id: "s1",
      userId: "u1",
      expire: "2026-01-01T00:00:00.000Z",
    });

    const api = createAccountApi(client);
    const session = await api.createEmailPasswordSession({
      email: "a@b.c",
      password: "secret",
    });

    expect(mocks.account.createEmailPasswordSession).toHaveBeenCalledWith({
      email: "a@b.c",
      password: "secret",
    });
    expect(session).toEqual({
      $id: "s1",
      userId: "u1",
      expire: "2026-01-01T00:00:00.000Z",
    });
  });

  it("deletes the current session by default", async () => {
    mocks.account.deleteSession.mockResolvedValue(undefined);

    const api = createAccountApi(client);
    await api.deleteSession();

    expect(mocks.account.deleteSession).toHaveBeenCalledWith({ sessionId: "current" });
  });

  it("deletes an explicit session", async () => {
    mocks.account.deleteSession.mockResolvedValue(undefined);

    const api = createAccountApi(client);
    await api.deleteSession("s9");

    expect(mocks.account.deleteSession).toHaveBeenCalledWith({ sessionId: "s9" });
  });

  it("wraps failures in ApiError", async () => {
    mocks.account.get.mockRejectedValue(new AppwriteException("nope", 401, "user_unauthorized"));

    const api = createAccountApi(client);

    await expect(api.getCurrentUser()).rejects.toBeInstanceOf(ApiError);
  });
});
