import { describe, expect, it, vi } from "vitest";

import { resolveGrants } from "./grant-resolver";

function createMockFunctionsApi(responseBody: string) {
  return {
    createExecution: vi.fn().mockResolvedValue({
      $id: "exec-1",
      status: "completed",
      responseBody,
    }),
  };
}

describe("resolveGrants", () => {
  it("returns GrantedAccess from a successful execution", async () => {
    const api = createMockFunctionsApi(
      JSON.stringify({ permissions: ["customers.read"], features: ["white-label"] }),
    );

    const result = await resolveGrants(api as any, {
      userId: "u1",
      organizationId: "org-1",
      applicationId: "admin",
    });

    expect(result).toEqual({
      permissions: ["customers.read"],
      features: ["white-label"],
    });

    expect(api.createExecution).toHaveBeenCalledWith({
      functionId: "resolve-grants",
      body: JSON.stringify({ userId: "u1", organizationId: "org-1", applicationId: "admin" }),
      method: "POST",
    });
  });

  it("returns empty arrays when no grants", async () => {
    const api = createMockFunctionsApi(
      JSON.stringify({ permissions: [], features: [] }),
    );

    const result = await resolveGrants(api as any, {
      userId: "u1",
      organizationId: "org-1",
      applicationId: "admin",
    });

    expect(result).toEqual({ permissions: [], features: [] });
  });

  it("throws when the Function returns an error", async () => {
    const api = createMockFunctionsApi(
      JSON.stringify({ error: "forbidden", reason: "not a member" }),
    );

    await expect(
      resolveGrants(api as any, {
        userId: "u1",
        organizationId: "org-1",
        applicationId: "admin",
      }),
    ).rejects.toThrow("resolve-grants failed: not a member");
  });

  it("throws when responseBody is invalid JSON", async () => {
    const api = createMockFunctionsApi("not-json");

    await expect(
      resolveGrants(api as any, {
        userId: "u1",
        organizationId: "org-1",
        applicationId: "admin",
      }),
    ).rejects.toThrow();
  });
});
