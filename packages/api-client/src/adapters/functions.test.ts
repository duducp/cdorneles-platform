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

function mockExecution(responseBody: string) {
  mocks.functions.createExecution.mockResolvedValue({
    $id: "e1",
    $createdAt: "2026-01-01T00:00:00.000Z",
    $updatedAt: "2026-01-01T00:00:00.000Z",
    $permissions: ['read("any")'],
    status: "completed",
    responseBody,
    logs: "stdout",
    errors: "",
    duration: 12.5,
  });
}

describe("createFunctionsApi user management", () => {
  it("posts create-user to the create-user function and returns the userId", async () => {
    mockExecution(JSON.stringify({ userId: "u1" }));
    const api = createFunctionsApi(client);

    const result = await api.createUser({
      email: "ada@example.com",
      name: "Ada",
      organizationId: "org-1",
      role: "admin",
      permissions: ["users.read"],
      labels: ["staff"],
    });

    expect(mocks.functions.createExecution).toHaveBeenCalledWith({
      functionId: "create-user",
      body: JSON.stringify({
        email: "ada@example.com",
        name: "Ada",
        organizationId: "org-1",
        role: "admin",
        permissions: ["users.read"],
        labels: ["staff"],
      }),
      async: false,
      xpath: undefined,
      method: "POST",
    });
    expect(result).toEqual({ userId: "u1" });
  });

  it("omits optional create-user fields when not provided", async () => {
    mockExecution(JSON.stringify({ userId: "u1" }));
    const api = createFunctionsApi(client);

    await api.createUser({
      email: "ada@example.com",
      name: "Ada",
      organizationId: "org-1",
      role: "admin",
    });

    expect(mocks.functions.createExecution).toHaveBeenCalledWith(
      expect.objectContaining({
        functionId: "create-user",
        body: JSON.stringify({
          email: "ada@example.com",
          name: "Ada",
          organizationId: "org-1",
          role: "admin",
        }),
      }),
    );
  });

  it("throws the create-user error reason", async () => {
    mockExecution(JSON.stringify({ error: "conflict", reason: "email already taken" }));
    const api = createFunctionsApi(client);

    const promise = api.createUser({
      email: "ada@example.com",
      name: "Ada",
      organizationId: "org-1",
      role: "admin",
    });

    await expect(promise).rejects.toBeInstanceOf(ApiError);
    await expect(promise).rejects.toThrow("email already taken");
  });

  it("posts update-user-permissions and resolves with no value", async () => {
    mockExecution("{}");
    const api = createFunctionsApi(client);

    await expect(
      api.updateUserPermissions({
        userId: "u1",
        organizationId: "org-1",
        permissions: ["users.read"],
      }),
    ).resolves.toBeUndefined();

    expect(mocks.functions.createExecution).toHaveBeenCalledWith({
      functionId: "update-user-permissions",
      body: JSON.stringify({
        userId: "u1",
        organizationId: "org-1",
        permissions: ["users.read"],
      }),
      async: false,
      xpath: undefined,
      method: "POST",
    });
  });

  it("throws the update-user-permissions error reason", async () => {
    mockExecution(JSON.stringify({ error: "forbidden", reason: "not an admin" }));
    const api = createFunctionsApi(client);

    await expect(
      api.updateUserPermissions({ userId: "u1", organizationId: "org-1", permissions: [] }),
    ).rejects.toThrow("not an admin");
  });

  it("posts list-users and returns the users", async () => {
    const users = [{ id: "u1", email: "ada@example.com", name: "Ada", labels: [] }];
    mockExecution(JSON.stringify({ users }));
    const api = createFunctionsApi(client);

    const result = await api.listUsers();

    expect(mocks.functions.createExecution).toHaveBeenCalledWith({
      functionId: "list-users",
      body: "{}",
      async: false,
      xpath: undefined,
      method: "POST",
    });
    expect(result).toEqual({ users });
  });

  it("throws the list-users error reason", async () => {
    mockExecution(JSON.stringify({ error: "unauthorized", reason: "no session" }));
    const api = createFunctionsApi(client);

    await expect(api.listUsers()).rejects.toThrow("no session");
  });

  it("falls back to the error code when no reason is given", async () => {
    mockExecution(JSON.stringify({ error: "boom" }));
    const api = createFunctionsApi(client);

    await expect(api.listUsers()).rejects.toThrow("boom");
  });

  it("throws an ApiError for an empty response body", async () => {
    mockExecution("");
    const api = createFunctionsApi(client);

    const promise = api.listUsers();

    await expect(promise).rejects.toBeInstanceOf(ApiError);
    await expect(promise).rejects.not.toBeInstanceOf(SyntaxError);
  });

  it("throws an ApiError for a non-JSON response body", async () => {
    mockExecution("not-json");
    const api = createFunctionsApi(client);

    const promise = api.listUsers();

    await expect(promise).rejects.toBeInstanceOf(ApiError);
    await expect(promise).rejects.not.toBeInstanceOf(SyntaxError);
  });

  it("throws an ApiError for a null response body", async () => {
    mockExecution("null");
    const api = createFunctionsApi(client);

    const promise = api.listUsers();

    await expect(promise).rejects.toBeInstanceOf(ApiError);
    await expect(promise).rejects.not.toBeInstanceOf(TypeError);
  });

  it("throws an ApiError for a scalar JSON response body", async () => {
    mockExecution(JSON.stringify("x"));
    const api = createFunctionsApi(client);

    const promise = api.listUsers();

    await expect(promise).rejects.toBeInstanceOf(ApiError);
    await expect(promise).rejects.not.toBeInstanceOf(TypeError);
  });
});

describe("createFunctionsApi organizations", () => {
  it("posts list-organizations and returns the organizations", async () => {
    const organizations = [{ id: "org-1", name: "Acme" }];
    mockExecution(JSON.stringify({ organizations }));
    const api = createFunctionsApi(client);

    const result = await api.listOrganizations();

    expect(mocks.functions.createExecution).toHaveBeenCalledWith({
      functionId: "list-organizations",
      body: "{}",
      async: false,
      xpath: undefined,
      method: "POST",
    });
    expect(result).toEqual({ organizations });
  });

  it("returns an empty list when the function reports none", async () => {
    mockExecution(JSON.stringify({ organizations: [] }));
    const api = createFunctionsApi(client);

    await expect(api.listOrganizations()).resolves.toEqual({ organizations: [] });
  });

  it("throws the list-organizations error reason", async () => {
    mockExecution(
      JSON.stringify({ error: "forbidden", reason: "missing permission: organizations.read" }),
    );
    const api = createFunctionsApi(client);

    await expect(api.listOrganizations()).rejects.toThrow("missing permission: organizations.read");
  });
});
