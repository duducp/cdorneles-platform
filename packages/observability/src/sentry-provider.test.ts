import { describe, expect, it, vi } from "vitest";

import { createSentryProvider, type SentryLike, type SentryScope } from "./sentry-provider";

function createFakeSentry() {
  const scope: SentryScope = { setExtra: vi.fn() };
  const sentry: SentryLike = {
    captureException: vi.fn(),
    captureMessage: vi.fn(),
    setUser: vi.fn(),
    setContext: vi.fn(),
    withScope: vi.fn((callback: (scope: SentryScope) => void) => callback(scope)),
  };
  return { sentry, scope };
}

describe("createSentryProvider", () => {
  it("forwards the exception and its context to the injected Sentry", () => {
    const { sentry, scope } = createFakeSentry();
    const provider = createSentryProvider(sentry);
    const error = new Error("boom");

    provider.captureException(error, { route: "/" });

    expect(sentry.withScope).toHaveBeenCalledOnce();
    expect(scope.setExtra).toHaveBeenCalledWith("route", "/");
    expect(sentry.captureException).toHaveBeenCalledWith(error);
  });

  it("forwards messages with their mapped level", () => {
    const { sentry, scope } = createFakeSentry();
    const provider = createSentryProvider(sentry);

    provider.captureMessage("hello", "warning", { route: "/" });

    expect(scope.setExtra).toHaveBeenCalledWith("route", "/");
    expect(sentry.captureMessage).toHaveBeenCalledWith("hello", "warning");
  });

  it("forwards user, organization and arbitrary context", () => {
    const { sentry } = createFakeSentry();
    const provider = createSentryProvider(sentry);

    provider.setUser({ id: "u1" });
    provider.setOrganization({ id: "org1", name: "Acme" });
    provider.setContext("tenant", { id: "org1" });

    expect(sentry.setUser).toHaveBeenCalledWith({ id: "u1" });
    expect(sentry.setContext).toHaveBeenCalledWith("organization", { id: "org1", name: "Acme" });
    expect(sentry.setContext).toHaveBeenCalledWith("tenant", { id: "org1" });
  });

  it("falls back to the console when no Sentry is injected", () => {
    const provider = createSentryProvider();
    const spy = vi.spyOn(console, "error").mockImplementation(() => undefined);

    expect(() => provider.captureException(new Error("boom"))).not.toThrow();
    expect(spy).toHaveBeenCalled();

    spy.mockRestore();
  });
});
