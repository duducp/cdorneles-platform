import { describe, expect, it, vi } from "vitest";

import { createNoopProvider } from "./noop-provider";
import {
  createObservability,
  getObservabilityProvider,
  observability,
  setObservabilityProvider,
} from "./observability";
import type { ObservabilityProvider } from "./types";

describe("noop provider", () => {
  it("never throws for any call", () => {
    const provider = createNoopProvider();
    expect(() => provider.captureException(new Error("boom"))).not.toThrow();
    expect(() => provider.captureMessage("hello", "info", { a: 1 })).not.toThrow();
    expect(() => provider.setUser({ id: "u1" })).not.toThrow();
    expect(() => provider.setOrganization({ id: "org1" })).not.toThrow();
    expect(() => provider.setContext("k", null)).not.toThrow();
  });
});

describe("observability facade", () => {
  it("delegates every call to the configured provider", () => {
    const provider: ObservabilityProvider = {
      captureException: vi.fn(),
      captureMessage: vi.fn(),
      setUser: vi.fn(),
      setOrganization: vi.fn(),
      setContext: vi.fn(),
    };
    const client = createObservability(provider);
    const error = new Error("boom");

    client.captureException(error, { route: "/" });
    client.captureMessage("message", "warning", { route: "/" });
    client.setUser({ id: "u1", email: "u@example.com" });
    client.setOrganization({ id: "org1", name: "Acme" });
    client.setContext("tenant", { id: "org1" });

    expect(provider.captureException).toHaveBeenCalledWith(error, { route: "/" });
    expect(provider.captureMessage).toHaveBeenCalledWith("message", "warning", { route: "/" });
    expect(provider.setUser).toHaveBeenCalledWith({ id: "u1", email: "u@example.com" });
    expect(provider.setOrganization).toHaveBeenCalledWith({ id: "org1", name: "Acme" });
    expect(provider.setContext).toHaveBeenCalledWith("tenant", { id: "org1" });
  });

  it("routes the default facade to the active provider", () => {
    const provider: ObservabilityProvider = {
      captureException: vi.fn(),
      captureMessage: vi.fn(),
      setUser: vi.fn(),
      setOrganization: vi.fn(),
      setContext: vi.fn(),
    };
    setObservabilityProvider(provider);
    expect(getObservabilityProvider()).toBe(provider);

    observability.captureMessage("hi", "info");
    expect(provider.captureMessage).toHaveBeenCalledWith("hi", "info", undefined);

    setObservabilityProvider(createNoopProvider());
  });
});
