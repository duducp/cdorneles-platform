import { Client } from "appwrite";
import { describe, expect, it } from "vitest";

import { createAppwriteClient } from "./client";

describe("createAppwriteClient", () => {
  it("binds the endpoint and project to a real Appwrite client", () => {
    const client = createAppwriteClient({
      endpoint: "https://appwrite.example/v1",
      projectId: "p1",
    });

    expect(client).toBeInstanceOf(Client);
    expect(client.config.endpoint).toContain("appwrite.example");
    expect(client.config.project).toBe("p1");
  });
});
