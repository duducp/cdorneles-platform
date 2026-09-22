import "@testing-library/jest-dom/vitest";

import { ApiError } from "@cdorneles/api-client";
import { MantineProvider } from "@mantine/core";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { ReactElement } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { useAuthMock, notifyInfoMock, notifyHideMock, notifyErrorMock } = vi.hoisted(() => ({
  useAuthMock: vi.fn(),
  notifyInfoMock: vi.fn(),
  notifyHideMock: vi.fn(),
  notifyErrorMock: vi.fn(),
}));

vi.mock("@cdorneles/auth", () => ({ useAuth: useAuthMock }));
vi.mock("@cdorneles/ui", () => ({
  notifyInfo: notifyInfoMock,
  notifyHide: notifyHideMock,
  notifyError: notifyErrorMock,
}));

const { SessionExpiryNotice } = await import("./session-expiry-notice");

const NOTICE_ID = "session-expiring";

function authState(
  overrides: Partial<Record<"sessionState" | "status" | "renewSession", unknown>> = {},
) {
  return {
    sessionState: "active",
    status: "authenticated",
    // The real contract returns a Promise; a bare vi.fn() would return
    // undefined and the button handler's `.catch` would throw.
    renewSession: vi.fn().mockResolvedValue(undefined),
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

  it("renews the session when the action is pressed", () => {
    const renewSession = vi.fn().mockResolvedValue(undefined);
    useAuthMock.mockReturnValue(authState({ sessionState: "expiring", renewSession }));

    render(<SessionExpiryNotice />);

    const [, options] = notifyInfoMock.mock.calls[0];
    render(<MantineProvider>{options.action as ReactElement}</MantineProvider>);
    fireEvent.click(screen.getByRole("button", { name: "Renovar sessão" }));

    expect(renewSession).toHaveBeenCalledTimes(1);
  });

  it("surfaces a non-401 renewal failure to the user", async () => {
    const renewSession = vi.fn().mockRejectedValue(new Error("boom"));
    useAuthMock.mockReturnValue(authState({ sessionState: "expiring", renewSession }));

    render(<SessionExpiryNotice />);

    const [, options] = notifyInfoMock.mock.calls[0];
    render(<MantineProvider>{options.action as ReactElement}</MantineProvider>);
    fireEvent.click(screen.getByRole("button", { name: "Renovar sessão" }));

    await waitFor(() => expect(notifyErrorMock).toHaveBeenCalledTimes(1));
  });

  it("stays silent on a dead session and does not leak an unhandled rejection", async () => {
    const rejections: unknown[] = [];
    const onRejection = (reason: unknown) => {
      rejections.push(reason);
    };
    process.on("unhandledRejection", onRejection);

    try {
      // A plain function, not a vi.fn: vitest attaches its own handling to mock
      // return values, which would hide the very leak this test guards against.
      let calls = 0;
      const renewSession = () => {
        calls += 1;
        return Promise.reject(new ApiError("no", { status: 401 }));
      };
      useAuthMock.mockReturnValue(authState({ sessionState: "expiring", renewSession }));

      render(<SessionExpiryNotice />);

      const [, options] = notifyInfoMock.mock.calls[0];
      render(<MantineProvider>{options.action as ReactElement}</MantineProvider>);
      fireEvent.click(screen.getByRole("button", { name: "Renovar sessão" }));

      // Give Node a real turn to surface any unhandled rejection.
      await new Promise((resolve) => {
        setTimeout(resolve, 0);
      });

      expect(calls).toBe(1);
      expect(rejections).toHaveLength(0);
      // The provider already moved to "expired" and the dialog opens; the toast
      // must not also shout at the user.
      expect(notifyErrorMock).not.toHaveBeenCalled();
    } finally {
      process.off("unhandledRejection", onRejection);
    }
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
