import { describe, expect, it, vi } from "vitest";

import { createApiClient, type AppwriteServices } from "./client";
import { resolveApiClientConfig } from "./config";
import { ApiError, isApiError, toApiError } from "./errors";
import { createQueryClient } from "./query-client";

const services: AppwriteServices = {
  account: {
    getCurrentUser: vi.fn(),
    getCurrentSession: vi.fn(),
    updateSession: vi.fn(),
    listSessions: vi.fn(),
    createEmailPasswordSession: vi.fn(),
    createOAuth2Session: vi.fn(),
    deleteSession: vi.fn(),
    createRecovery: vi.fn(),
    updateRecovery: vi.fn(),
    listMfaFactors: vi.fn(),
    createMfaChallenge: vi.fn(),
    updateMfaChallenge: vi.fn(),
  },
  teams: { listTeams: vi.fn(), listMemberships: vi.fn(), createTeam: vi.fn() },
  tables: { listRows: vi.fn(), getRow: vi.fn() },
  functions: {
    createExecution: vi.fn(),
    createUser: vi.fn(),
    updateUserPermissions: vi.fn(),
    listUsers: vi.fn(),
    listOrganizations: vi.fn(),
  },
  storage: {
    getFilePreviewUrl: vi.fn(() => "https://example.com/preview"),
    uploadFile: vi.fn(),
    deleteFile: vi.fn(),
    listFiles: vi.fn(),
    getFileDownloadUrl: vi.fn(() => "https://example.com/download"),
    getFileViewUrl: vi.fn(() => "https://example.com/view"),
  },
};

describe("api client config", () => {
  it("trims valid values", () => {
    expect(resolveApiClientConfig({ endpoint: " https://x ", projectId: " p1 " })).toEqual({
      endpoint: "https://x",
      projectId: "p1",
    });
  });

  it("throws a normalized error when required values are missing", () => {
    expect(() => resolveApiClientConfig({ endpoint: "", projectId: "p1" })).toThrow(ApiError);
    expect(() => resolveApiClientConfig({ endpoint: "https://x", projectId: null })).toThrow(
      ApiError,
    );
  });
});

describe("api client factory", () => {
  it("exposes config and services", () => {
    const client = createApiClient({
      config: { endpoint: "https://x", projectId: "p1" },
      services,
    });
    expect(client.config.projectId).toBe("p1");
    expect(client.account).toBe(services.account);
  });
});

describe("api errors", () => {
  it("normalizes unknown errors", () => {
    const error = toApiError(new Error("network"), "network");
    expect(isApiError(error)).toBe(true);
    expect(error.code).toBe("network");
  });

  it("keeps existing ApiError instances", () => {
    const original = new ApiError("boom", { code: "conflict", status: 409 });
    expect(toApiError(original)).toBe(original);
  });
});

describe("query client", () => {
  it("applies foundation defaults", () => {
    const client = createQueryClient();
    const defaults = client.getDefaultOptions();
    expect(defaults.queries?.staleTime).toBe(30_000);
    expect(defaults.queries?.retry).toBe(1);
    expect(defaults.mutations?.retry).toBe(0);
  });
});
