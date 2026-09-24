import { AppwriteException, type Client } from "appwrite";
import type * as Appwrite from "appwrite";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ApiError } from "../errors";
import { createAccountApi } from "./account";

const mocks = vi.hoisted(() => ({
  account: {
    get: vi.fn(),
    getSession: vi.fn(),
    updateSession: vi.fn(),
    listSessions: vi.fn(),
    createEmailPasswordSession: vi.fn(),
    createSession: vi.fn(),
    deleteSession: vi.fn(),
    createRecovery: vi.fn(),
    updateRecovery: vi.fn(),
    listMfaFactors: vi.fn(),
    createMfaChallenge: vi.fn(),
    updateMfaChallenge: vi.fn(),
  },
}));

vi.mock("appwrite", async (importOriginal) => {
  const actual = await importOriginal<typeof Appwrite>();
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

  it("maps the current session", async () => {
    mocks.account.getSession.mockResolvedValue({
      $id: "s1",
      userId: "u1",
      expire: "2026-01-01T00:00:00.000Z",
    });

    const api = createAccountApi(client);

    await expect(api.getCurrentSession()).resolves.toEqual({
      $id: "s1",
      userId: "u1",
      expire: "2026-01-01T00:00:00.000Z",
    });
    expect(mocks.account.getSession).toHaveBeenCalledWith({ sessionId: "current" });
  });

  it("extends the current session", async () => {
    mocks.account.updateSession.mockResolvedValue({
      $id: "s1",
      userId: "u1",
      expire: "2099-01-01T00:00:00.000Z",
    });

    const api = createAccountApi(client);
    const session = await api.updateSession({ sessionId: "current" });

    expect(mocks.account.updateSession).toHaveBeenCalledWith({ sessionId: "current" });
    expect(session).toEqual({
      $id: "s1",
      userId: "u1",
      expire: "2099-01-01T00:00:00.000Z",
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

  it("creates a session from a server-issued userId/secret pair", async () => {
    mocks.account.createSession.mockResolvedValue({
      $id: "s1",
      userId: "u1",
      expire: "2026-01-01T00:00:00.000Z",
    });

    const api = createAccountApi(client);
    const session = await api.createSessionFromToken({ userId: "u1", secret: "the-secret" });

    expect(mocks.account.createSession).toHaveBeenCalledWith("u1", "the-secret");
    expect(session).toEqual({
      $id: "s1",
      userId: "u1",
      expire: "2026-01-01T00:00:00.000Z",
    });
  });

  it("wraps createSession failures in ApiError", async () => {
    mocks.account.createSession.mockRejectedValue(
      new AppwriteException("nope", 401, "user_unauthorized"),
    );

    const api = createAccountApi(client);

    await expect(
      api.createSessionFromToken({ userId: "u1", secret: "bad" }),
    ).rejects.toBeInstanceOf(ApiError);
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

  it("creates a recovery with the given e-mail and url", async () => {
    mocks.account.createRecovery.mockResolvedValue(undefined);

    const api = createAccountApi(client);
    await api.createRecovery({ email: "a@b.c", url: "https://app.test/reset-password" });

    expect(mocks.account.createRecovery).toHaveBeenCalledWith({
      email: "a@b.c",
      url: "https://app.test/reset-password",
    });
  });

  it("updates a recovery with the secret and the new password", async () => {
    mocks.account.updateRecovery.mockResolvedValue(undefined);

    const api = createAccountApi(client);
    await api.updateRecovery({
      userId: "u1",
      secret: "s1",
      password: "s3cret-pass",
    });

    expect(mocks.account.updateRecovery).toHaveBeenCalledWith({
      userId: "u1",
      secret: "s1",
      password: "s3cret-pass",
    });
  });

  it("maps the available MFA factors", async () => {
    mocks.account.listMfaFactors.mockResolvedValue({
      totp: true,
      phone: false,
      email: true,
      recoveryCode: false,
    });

    const api = createAccountApi(client);

    await expect(api.listMfaFactors()).resolves.toEqual({
      totp: true,
      phone: false,
      email: true,
      recoveryCode: false,
    });
  });

  it("creates an MFA challenge for the given factor", async () => {
    mocks.account.createMfaChallenge.mockResolvedValue({
      $id: "c1",
      userId: "u1",
      factor: "email",
    });

    const api = createAccountApi(client);
    const challenge = await api.createMfaChallenge({ factor: "email" });

    expect(mocks.account.createMfaChallenge).toHaveBeenCalledWith({ factor: "email" });
    expect(challenge).toEqual({ $id: "c1", factor: "email" });
  });

  it("completes an MFA challenge and maps the session", async () => {
    mocks.account.updateMfaChallenge.mockResolvedValue({
      $id: "s1",
      userId: "u1",
      expire: "2026-01-01T00:00:00.000Z",
    });

    const api = createAccountApi(client);
    const session = await api.updateMfaChallenge({ challengeId: "c1", otp: "123456" });

    expect(mocks.account.updateMfaChallenge).toHaveBeenCalledWith({
      challengeId: "c1",
      otp: "123456",
    });
    expect(session).toEqual({
      $id: "s1",
      userId: "u1",
      expire: "2026-01-01T00:00:00.000Z",
    });
  });
});
