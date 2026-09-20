import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { type ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";

import { AuthProvider, useAuth, type AuthContextValue } from "./auth-context";
import type { AuthService, AuthSession, AuthUser } from "./types";

const futureDate = new Date(Date.now() + 86400000).toISOString();

function createMockService(overrides?: Partial<AuthService>): AuthService {
  return {
    login: vi.fn(),
    completeMfa: vi.fn(),
    logout: vi.fn(),
    getSession: vi.fn(),
    getCurrentUser: vi.fn(),
    requestPasswordRecovery: vi.fn(),
    confirmPasswordRecovery: vi.fn(),
    ...overrides,
  };
}

function createMockUser(overrides?: Partial<AuthUser>): AuthUser {
  return {
    id: "u1",
    email: "user@example.com",
    name: "User",
    emailVerified: false,
    mfaEnabled: false,
    ...overrides,
  };
}

function createMockSession(overrides?: Partial<AuthSession>): AuthSession {
  return {
    id: "s1",
    userId: "u1",
    expiresAt: futureDate,
    ...overrides,
  };
}

function TestConsumer() {
  const { user, session, status, login, completeMfa, logout, refresh } = useAuth();

  return (
    <div>
      <span data-testid="status">{status}</span>
      <span data-testid="user">{user?.email ?? "null"}</span>
      <span data-testid="session">{session?.id ?? "null"}</span>
      <button
        onClick={() =>
          login({ email: "a@b.c", password: "pass" }).catch(() => {
            /* intentionally empty */
          })
        }
      >
        login
      </button>
      <button
        onClick={() =>
          completeMfa({ challengeId: "c1", code: "123456" }).catch(() => {
            /* intentionally empty */
          })
        }
      >
        completeMfa
      </button>
      <button onClick={() => logout()}>logout</button>
      <button onClick={() => refresh()}>refresh</button>
    </div>
  );
}

function renderWithAuth(service: AuthService, children?: ReactNode) {
  return render(
    <AuthProvider service={service}>
      {children ?? <TestConsumer />}
    </AuthProvider>,
  );
}

describe("AuthProvider", () => {
  it("starts in anonymous state when no initial user", () => {
    const service = createMockService();
    renderWithAuth(service);

    expect(screen.getByTestId("status")).toHaveTextContent("anonymous");
    expect(screen.getByTestId("user")).toHaveTextContent("null");
    expect(screen.getByTestId("session")).toHaveTextContent("null");
  });

  it("starts in authenticated state when initialUser is provided", () => {
    const service = createMockService();

    render(
      <AuthProvider service={service} initialUser={createMockUser()} initialSession={createMockSession()}>
        <TestConsumer />
      </AuthProvider>,
    );

    expect(screen.getByTestId("status")).toHaveTextContent("authenticated");
    expect(screen.getByTestId("user")).toHaveTextContent("user@example.com");
  });

  it("login calls service.login and updates state", async () => {
    const user = userEvent.setup();
    const service = createMockService({
      login: vi.fn().mockResolvedValue(createMockSession()),
      getCurrentUser: vi.fn().mockResolvedValue(createMockUser()),
    });

    renderWithAuth(service);
    await user.click(screen.getByRole("button", { name: "login" }));

    expect(service.login).toHaveBeenCalledWith({ email: "a@b.c", password: "pass" });
    expect(screen.getByTestId("status")).toHaveTextContent("authenticated");
    expect(screen.getByTestId("user")).toHaveTextContent("user@example.com");
    expect(screen.getByTestId("session")).toHaveTextContent("s1");
  });

  it("completeMfa calls service.completeMfa and updates state", async () => {
    const user = userEvent.setup();
    const service = createMockService({
      completeMfa: vi.fn().mockResolvedValue(createMockSession()),
      getCurrentUser: vi.fn().mockResolvedValue(createMockUser()),
    });

    renderWithAuth(service);
    await user.click(screen.getByRole("button", { name: "completeMfa" }));

    expect(service.completeMfa).toHaveBeenCalledWith({ challengeId: "c1", code: "123456" });
    expect(screen.getByTestId("status")).toHaveTextContent("authenticated");
    expect(screen.getByTestId("user")).toHaveTextContent("user@example.com");
    expect(screen.getByTestId("session")).toHaveTextContent("s1");
  });

  it("logout calls service.logout and clears state", async () => {
    const user = userEvent.setup();
    const service = createMockService({
      logout: vi.fn().mockResolvedValue(undefined),
    });

    renderWithAuth(service, <TestConsumer />);
    await user.click(screen.getByRole("button", { name: "logout" }));

    expect(service.logout).toHaveBeenCalledWith(undefined);
    expect(screen.getByTestId("status")).toHaveTextContent("anonymous");
    expect(screen.getByTestId("user")).toHaveTextContent("null");
    expect(screen.getByTestId("session")).toHaveTextContent("null");
  });

  it("refresh calls service.getSession and service.getCurrentUser", async () => {
    const user = userEvent.setup();
    const service = createMockService({
      getSession: vi.fn().mockResolvedValue(createMockSession()),
      getCurrentUser: vi.fn().mockResolvedValue(createMockUser()),
    });

    renderWithAuth(service, <TestConsumer />);
    await user.click(screen.getByRole("button", { name: "refresh" }));

    expect(service.getSession).toHaveBeenCalled();
    expect(service.getCurrentUser).toHaveBeenCalled();
    expect(screen.getByTestId("status")).toHaveTextContent("authenticated");
    expect(screen.getByTestId("user")).toHaveTextContent("user@example.com");
  });

  it("throws when useAuth is used outside AuthProvider", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {
      /* suppress React error boundary noise */
    });

    function BadConsumer() {
      useAuth();
      return null;
    }

    expect(() => render(<BadConsumer />)).toThrow("useAuth must be used within <AuthProvider>");
    spy.mockRestore();
  });
});
