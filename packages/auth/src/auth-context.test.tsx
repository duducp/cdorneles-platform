import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { type ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";

import { AuthProvider, useAuth } from "./auth-context";
import { createSessionSignal } from "./session-signal";
import type { AuthService, AuthSession, AuthUser } from "./types";

const futureDate = new Date(Date.now() + 86400000).toISOString();

function createMockService(overrides?: Partial<AuthService>): AuthService {
  return {
    login: vi.fn(),
    completeMfa: vi.fn(),
    listMfaFactors: vi.fn(),
    createMfaChallenge: vi.fn(),
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
  it("resolves to anonymous when there is no session", async () => {
    const service = createMockService({
      getSession: vi.fn().mockResolvedValue(null),
      getCurrentUser: vi.fn().mockResolvedValue(null),
    });
    renderWithAuth(service);

    // Starts loading while any existing session is resolved, so the app never
    // assumes "signed out" before it has looked.
    expect(screen.getByTestId("status")).toHaveTextContent("loading");

    await waitFor(() => expect(screen.getByTestId("status")).toHaveTextContent("anonymous"));
    expect(screen.getByTestId("user")).toHaveTextContent("null");
    expect(screen.getByTestId("session")).toHaveTextContent("null");
  });

  it("restores an existing session on mount", async () => {
    const service = createMockService({
      getSession: vi.fn().mockResolvedValue(createMockSession()),
      getCurrentUser: vi.fn().mockResolvedValue(createMockUser()),
    });
    renderWithAuth(service);

    await waitFor(() => expect(screen.getByTestId("status")).toHaveTextContent("authenticated"));
    expect(screen.getByTestId("user")).toHaveTextContent("user@example.com");
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

function SessionStateProbe() {
  const { status, sessionState } = useAuth();
  return <span data-testid="probe">{`${status}:${sessionState}`}</span>;
}

describe("session state", () => {
  it("does not navigate when the session dies while running", async () => {
    const service = createMockService({
      getSession: vi
        .fn()
        .mockResolvedValueOnce(createMockSession())
        .mockResolvedValue(null),
      getCurrentUser: vi.fn().mockResolvedValue(createMockUser()),
    });
    const signal = createSessionSignal();
    const assign = vi.fn();
    // Track href writes so the assertion proves *no* navigation happened.
    // `redirectToLogin` navigates by assigning `location.href`, not `assign()`,
    // so checking `assign` alone would pass even if the code did navigate.
    let href = "";
    Object.defineProperty(window, "location", {
      value: {
        pathname: "/dashboard",
        assign,
        get href(): string {
          return href;
        },
        set href(value: string) {
          href = value;
        },
      },
      writable: true,
      configurable: true,
    });

    render(
      <AuthProvider service={service} sessionSignal={signal}>
        <SessionStateProbe />
      </AuthProvider>,
    );

    await waitFor(() =>
      expect(screen.getByTestId("probe")).toHaveTextContent("authenticated:active"),
    );

    signal.notifyExpired();

    await waitFor(() =>
      expect(screen.getByTestId("probe")).toHaveTextContent("authenticated:expired"),
    );
    expect(assign).not.toHaveBeenCalled();
    expect(href).toBe("");
  });

  it("redirects on bootstrap when there is no session at all", async () => {
    const service = createMockService({
      getSession: vi.fn().mockResolvedValue(null),
      getCurrentUser: vi.fn().mockResolvedValue(null),
    });
    const replace = vi.fn();
    Object.defineProperty(window, "location", {
      value: { pathname: "/dashboard", replace, href: "" },
      writable: true,
      configurable: true,
    });

    render(
      <AuthProvider service={service}>
        <SessionStateProbe />
      </AuthProvider>,
    );

    await waitFor(() => expect(window.location.href).toContain("/login"));
    expect(replace).not.toHaveBeenCalled();
  });
});
