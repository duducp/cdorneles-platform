import "@testing-library/jest-dom/vitest";

import { render } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { useAuthMock, notifyInfoMock, notifyHideMock } = vi.hoisted(() => ({
  useAuthMock: vi.fn(),
  notifyInfoMock: vi.fn(),
  notifyHideMock: vi.fn(),
}));

vi.mock("@cdorneles/auth", () => ({ useAuth: useAuthMock }));
vi.mock("@cdorneles/ui", () => ({
  notifyInfo: notifyInfoMock,
  notifyHide: notifyHideMock,
}));

const { SessionExpiryNotice } = await import("./session-expiry-notice");

const NOTICE_ID = "session-expiring";

function authState(overrides: Partial<Record<"sessionState" | "status", unknown>> = {}) {
  return {
    sessionState: "active",
    status: "authenticated",
    refresh: vi.fn(),
    ...overrides,
  };
}

describe("SessionExpiryNotice", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("warns, without auto-closing, while the session is expiring", () => {
    useAuthMock.mockReturnValue(authState({ sessionState: "expiring" }));

    render(<SessionExpiryNotice />);

    expect(notifyInfoMock).toHaveBeenCalledTimes(1);
    const [message, options] = notifyInfoMock.mock.calls[0];
    expect(message).toMatch(/expira/i);
    expect(options.id).toBe(NOTICE_ID);
    expect(options.autoClose).toBe(false);
    expect(options.action).toBeTruthy();
  });

  it("stays silent while the session is healthy", () => {
    useAuthMock.mockReturnValue(authState());

    render(<SessionExpiryNotice />);

    expect(notifyInfoMock).not.toHaveBeenCalled();
    expect(notifyHideMock).toHaveBeenCalledWith(NOTICE_ID);
  });

  it("does not warn an anonymous visitor", () => {
    useAuthMock.mockReturnValue(authState({ sessionState: "expiring", status: "anonymous" }));

    render(<SessionExpiryNotice />);

    expect(notifyInfoMock).not.toHaveBeenCalled();
  });

  it("clears the warning once the session is renewed", () => {
    useAuthMock.mockReturnValue(authState({ sessionState: "expiring" }));
    const { rerender } = render(<SessionExpiryNotice />);
    expect(notifyInfoMock).toHaveBeenCalledTimes(1);

    useAuthMock.mockReturnValue(authState());
    rerender(<SessionExpiryNotice />);

    expect(notifyHideMock).toHaveBeenCalledWith(NOTICE_ID);
  });
});
