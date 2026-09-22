import { describe, expect, it, vi } from "vitest";

import { createSessionSignal } from "./session-signal";

describe("createSessionSignal", () => {
  it("notifies every subscriber", () => {
    const signal = createSessionSignal();
    const first = vi.fn();
    const second = vi.fn();
    signal.subscribe(first);
    signal.subscribe(second);

    signal.notifyExpired();

    expect(first).toHaveBeenCalledTimes(1);
    expect(second).toHaveBeenCalledTimes(1);
  });

  it("stops notifying after unsubscribe", () => {
    const signal = createSessionSignal();
    const listener = vi.fn();
    const unsubscribe = signal.subscribe(listener);

    unsubscribe();
    signal.notifyExpired();

    expect(listener).not.toHaveBeenCalled();
  });

  it("survives a listener that unsubscribes during notification", () => {
    const signal = createSessionSignal();
    const second = vi.fn();
    signal.subscribe(() => signal.unsubscribeAll());
    signal.subscribe(second);

    signal.notifyExpired();
    expect(second).toHaveBeenCalledTimes(1);
  });
});
