import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { type ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { AuthProvider, useAuth } from "./auth-context";
import { createSessionSignal } from "./session-signal";
import type { AuthService, AuthSession, AuthUser } from "./types";

// `document.cookie` is shared jsdom state. Clear it before every test so the
// bootstrap-redirect cases cannot leak into each other or the existing tests.
beforeEach(() => {
  for (const entry of document.cookie.split("; ")) {
    const name = entry.split("=")[0];
    if (name) {
      document.cookie = `${name}=; path=/; max-age=0`;
    }
  }
});

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

function stubLocation(pathname: string) {
  let href = "";
  const assign = vi.fn();
  Object.defineProperty(window, "location", {
    value: {
      pathname,
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
  return { assign };
}

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
    const location = stubLocation("/dashboard");

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
    // `redirectToLogin` navigates by assigning `location.href`, not `assign()`,
    // so assert on href to prove no navigation happened.
    expect(location.assign).not.toHaveBeenCalled();
    expect(window.location.href).toBe("");
  });

  it("redirects on bootstrap when a session cookie was present but the session is gone", async () => {
    document.cookie = "cdorneles-session=1";
    const service = createMockService({
      getSession: vi.fn().mockResolvedValue(null),
      getCurrentUser: vi.fn().mockResolvedValue(null),
    });
    const location = stubLocation("/dashboard");

    render(
      <AuthProvider service={service}>
        <SessionStateProbe />
      </AuthProvider>,
    );

    await waitFor(() => expect(window.location.href).toContain("/login"));
    expect(location.assign).not.toHaveBeenCalled();
  });

  it("does not redirect a truly anonymous visitor on bootstrap", async () => {
    document.cookie = "cdorneles-session=; path=/; max-age=0";
    const service = createMockService({
      getSession: vi.fn().mockResolvedValue(null),
      getCurrentUser: vi.fn().mockResolvedValue(null),
    });
    const location = stubLocation("/forgot-password");

    render(
      <AuthProvider service={service}>
        <SessionStateProbe />
      </AuthProvider>,
    );

    await waitFor(() =>
      expect(screen.getByTestId("probe")).toHaveTextContent("anonymous:active"),
    );
    expect(window.location.href).toBe("");
    expect(location.assign).not.toHaveBeenCalled();
  });
});
