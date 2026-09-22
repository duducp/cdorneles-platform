import "@testing-library/jest-dom/vitest";

import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

const { useAuthMock, SessionExpiredDialogMock, SessionExpiredMfaDialogMock } = vi.hoisted(() => ({
  useAuthMock: vi.fn(),
  SessionExpiredDialogMock: vi.fn(() => <div data-testid="password-dialog" />),
  SessionExpiredMfaDialogMock: vi.fn(() => <div data-testid="mfa-dialog" />),
}));

vi.mock("@cdorneles/auth", () => ({
  useAuth: useAuthMock,
  MfaRequiredError: class MfaRequiredError extends Error {
    override name = "MfaRequiredError" as const;
  },
  describeAuthError: vi.fn((e: Error) => e.message),
}));

vi.mock("@cdorneles/ui", () => ({
  SessionExpiredDialog: SessionExpiredDialogMock,
  SessionExpiredMfaDialog: SessionExpiredMfaDialogMock,
}));

vi.mock("@tanstack/react-query", () => ({
  useQueryClient: () => ({ invalidateQueries: vi.fn() }),
}));

const { SessionExpiredGate } = await import("./session-expired-gate");

function authState(
  overrides: Partial<Record<"sessionState" | "user" | "service" | "refresh", unknown>> = {},
) {
  return {
    sessionState: "active",
    user: null,
    refresh: vi.fn(),
    reauthenticate: vi.fn(),
    completeReauthMfa: vi.fn(),
    logout: vi.fn(),
    service: { createMfaChallenge: vi.fn() },
    ...overrides,
  };
}

describe("SessionExpiredGate", () => {
  it("renders nothing when sessionState is active", () => {
    useAuthMock.mockReturnValue(authState());
    const { container } = render(<SessionExpiredGate />);
    expect(container.innerHTML).toBe("");
  });

  it("renders nothing when sessionState is expired but user is null", () => {
    useAuthMock.mockReturnValue(authState({ sessionState: "expired" }));
    const { container } = render(<SessionExpiredGate />);
    expect(container.innerHTML).toBe("");
  });

  it("renders SessionExpiredDialog when sessionState is expired and user exists", () => {
    useAuthMock.mockReturnValue(
      authState({
        sessionState: "expired",
        user: { email: "user@example.com" },
      }),
    );
    render(<SessionExpiredGate />);
    expect(screen.getByTestId("password-dialog")).toBeInTheDocument();
  });

  it("revalidates when another tab renews the session", () => {
    const refreshMock = vi.fn();
    useAuthMock.mockReturnValue(
      authState({
        sessionState: "expired",
        user: { email: "user@example.com" },
        refresh: refreshMock,
      }),
    );

    render(<SessionExpiredGate />);

    window.dispatchEvent(new StorageEvent("storage", { key: "cdorneles-session-renewed" }));

    expect(refreshMock).toHaveBeenCalled();
  });
});
