import { describe, expect, it } from "vitest";

import { createAppwriteApiClient, createAppwriteServices } from "./appwrite";

const config = { endpoint: "https://appwrite.example/v1", projectId: "p1" };

describe("createAppwriteServices", () => {
  it("wires all five services", () => {
    const services = createAppwriteServices(config);

    expect(typeof services.account.getCurrentUser).toBe("function");
    expect(typeof services.teams.listTeams).toBe("function");
    expect(typeof services.databases.listDocuments).toBe("function");
    expect(typeof services.functions.createExecution).toBe("function");
    expect(typeof services.storage.getFilePreviewUrl).toBe("function");
  });
});

describe("createAppwriteApiClient", () => {
  it("exposes the validated config and the wired services", () => {
    const client = createAppwriteApiClient(config);

    expect(client.config).toEqual(config);
    expect(typeof client.account.getCurrentUser).toBe("function");
  });
});
