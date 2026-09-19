import { describe, expect, it } from "vitest";

import { resolveProvisioningEnv } from "../env.js";

describe("resolveProvisioningEnv", () => {
  it("prefers the server-side APPWRITE_* names", () => {
    const resolved = resolveProvisioningEnv({
      APPWRITE_ENDPOINT: "https://server.example/v1",
      APPWRITE_PROJECT_ID: "server-project",
      NEXT_PUBLIC_APPWRITE_ENDPOINT: "https://public.example/v1",
      NEXT_PUBLIC_APPWRITE_PROJECT_ID: "public-project",
      APPWRITE_API_KEY: "key",
    });

    expect(resolved).toEqual({
      endpoint: "https://server.example/v1",
      projectId: "server-project",
      apiKey: "key",
    });
  });

  it("falls back to the public NEXT_PUBLIC_* names", () => {
    const resolved = resolveProvisioningEnv({
      NEXT_PUBLIC_APPWRITE_ENDPOINT: "https://public.example/v1",
      NEXT_PUBLIC_APPWRITE_PROJECT_ID: "public-project",
      APPWRITE_API_KEY: "key",
    });

    expect(resolved).toEqual({
      endpoint: "https://public.example/v1",
      projectId: "public-project",
      apiKey: "key",
    });
  });

  it("returns null without an API key", () => {
    expect(
      resolveProvisioningEnv({
        NEXT_PUBLIC_APPWRITE_ENDPOINT: "https://public.example/v1",
        NEXT_PUBLIC_APPWRITE_PROJECT_ID: "public-project",
      }),
    ).toBeNull();
  });

  it("returns null without an endpoint or project", () => {
    expect(resolveProvisioningEnv({ APPWRITE_API_KEY: "key" })).toBeNull();
    expect(
      resolveProvisioningEnv({
        APPWRITE_ENDPOINT: "https://server.example/v1",
        APPWRITE_API_KEY: "key",
      }),
    ).toBeNull();
  });
});
