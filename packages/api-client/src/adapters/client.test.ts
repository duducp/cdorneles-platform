import { Client } from "appwrite";
import { describe, expect, it } from "vitest";

import { APPWRITE_LOCALE, createAppwriteClient } from "./client";

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

  it("sets the Brazilian Portuguese locale for Appwrite email templates", () => {
    const client = createAppwriteClient({
      endpoint: "https://appwrite.example/v1",
      projectId: "p1",
    });

    expect(APPWRITE_LOCALE).toBe("pt-br");
    expect(client.config.locale).toBe("pt-br");
    expect(client.headers["X-Appwrite-Locale"]).toBe("pt-br");
  });
});
