import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { type ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ApiError } from "@cdorneles/api-client";

import { AuthProvider, useAuth } from "./auth-context";
import { MfaRequiredError } from "./errors";
import { createSessionSignal } from "./session-signal";
import type { AuthService, AuthSession, AuthUser } from "./types";

// Must match SESSION_POLL_INTERVAL in auth-context.tsx (4 minutes). If the real
// interval changes, advancing this much stops firing the poll and the fake-timer
// tests fail loudly instead of passing silently.
const POLL_INTERVAL_MS = 4 * 60 * 1000;

const originalLocationDescriptor = Object.getOwnPropertyDescriptor(window, "location");

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

afterEach(() => {
  vi.useRealTimers();
  if (originalLocationDescriptor) {
    Object.defineProperty(window, "location", originalLocationDescriptor);
  } else {
    Reflect.deleteProperty(window, "location");
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
    renewSession: vi.fn(),
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
  const { user, session, status, login, completeMfa, logout, refresh, renewSession } = useAuth();

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
      <button
        onClick={() =>
          renewSession().catch(() => {
            /* intentionally empty */
          })
        }
      >
        renewSession
      </button>
    </div>
  );
}

function renderWithAuth(service: AuthService, children?: ReactNode) {
  return render(<AuthProvider service={service}>{children ?? <TestConsumer />}</AuthProvider>);
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
      <AuthProvider
        service={service}
        initialUser={createMockUser()}
        initialSession={createMockSession()}
      >
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

  it("renewSession calls service.renewSession and updates the session", async () => {
    const user = userEvent.setup();
    const service = createMockService({
      renewSession: vi.fn().mockResolvedValue(createMockSession({ id: "s2" })),
    });

    renderWithAuth(service, <TestConsumer />);
    await user.click(screen.getByRole("button", { name: "renewSession" }));

    expect(service.renewSession).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId("session")).toHaveTextContent("s2");
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
  Object.defineProperty(window, "location", {
    value: {
      pathname,
      assign: vi.fn(),
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
}

async function flushMicrotasks(): Promise<void> {
  for (let i = 0; i < 10; i += 1) {
    await act(async () => {
      await Promise.resolve();
    });
  }
}

function SessionStateProbe() {
  const { status, sessionState } = useAuth();
  return <span data-testid="probe">{`${status}:${sessionState}`}</span>;
}

/**
 * Captures the auth context value from inside the provider. `current` is a
 * function rather than a plain variable so TypeScript does not narrow the
 * closure-assigned value to `never`, and so every call reads the latest value.
 */
function captureAuth() {
  let value: ReturnType<typeof useAuth> | null = null;
  function Capture() {
    value = useAuth();
    return null;
  }
  return {
    Capture,
    current: () => value as ReturnType<typeof useAuth>,
  };
}

describe("session state", () => {
  it("does not navigate when the session dies while running", async () => {
    const service = createMockService({
      getSession: vi.fn().mockResolvedValueOnce(createMockSession()).mockResolvedValue(null),
      getCurrentUser: vi.fn().mockResolvedValue(createMockUser()),
    });
    const signal = createSessionSignal();
    stubLocation("/dashboard");

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
    // `redirectToLogin` navigates by assigning `location.href`; this is the real
    // assertion that no navigation happened.
    expect(window.location.href).toBe("");
  });

  it("ignores a 401 seen while anonymous", async () => {
    const service = createMockService({
      getSession: vi.fn().mockResolvedValue(null),
      getCurrentUser: vi.fn().mockResolvedValue(null),
    });
    const signal = createSessionSignal();
    stubLocation("/login");

    render(
      <AuthProvider service={service} sessionSignal={signal}>
        <SessionStateProbe />
      </AuthProvider>,
    );

    await waitFor(() => expect(screen.getByTestId("probe")).toHaveTextContent("anonymous:active"));

    await act(async () => {
      signal.notifyExpired();
    });

    // A 401 while anonymous must not fabricate an authenticated identity.
    expect(screen.getByTestId("probe")).toHaveTextContent("anonymous:active");
    expect(window.location.href).toBe("");
  });

  it("marks the session expired when the poll finds it gone", async () => {
    vi.useFakeTimers({ toFake: ["setInterval", "clearInterval"] });
    const service = createMockService({
      getSession: vi.fn().mockResolvedValueOnce(createMockSession()).mockResolvedValue(null),
      getCurrentUser: vi.fn().mockResolvedValue(createMockUser()),
    });
    stubLocation("/dashboard");

    render(
      <AuthProvider service={service}>
        <SessionStateProbe />
      </AuthProvider>,
    );

    await flushMicrotasks();
    expect(screen.getByTestId("probe")).toHaveTextContent("authenticated:active");

    await act(async () => {
      await vi.advanceTimersByTimeAsync(POLL_INTERVAL_MS);
    });

    expect(screen.getByTestId("probe")).toHaveTextContent("authenticated:expired");
    expect(window.location.href).toBe("");
  });

  it("ignores a transient poll failure and keeps the session active", async () => {
    vi.useFakeTimers({ toFake: ["setInterval", "clearInterval"] });
    const rejections: unknown[] = [];
    const onRejection = (reason: unknown) => {
      rejections.push(reason);
    };
    process.on("unhandledRejection", onRejection);

    try {
      const service = createMockService({
        getSession: vi
          .fn()
          .mockResolvedValueOnce(createMockSession())
          .mockRejectedValue(new Error("network")),
        getCurrentUser: vi.fn().mockResolvedValue(createMockUser()),
      });
      stubLocation("/dashboard");

      render(
        <AuthProvider service={service}>
          <SessionStateProbe />
        </AuthProvider>,
      );

      await flushMicrotasks();
      expect(screen.getByTestId("probe")).toHaveTextContent("authenticated:active");

      await act(async () => {
        await vi.advanceTimersByTimeAsync(POLL_INTERVAL_MS);
      });

      // Give Node a real turn to surface any unhandled rejection.
      await new Promise((resolve) => {
        setTimeout(resolve, 0);
      });

      expect(screen.getByTestId("probe")).toHaveTextContent("authenticated:active");
      expect(rejections).toHaveLength(0);
    } finally {
      process.off("unhandledRejection", onRejection);
    }
  });

  it("redirects on bootstrap when a session cookie was present but the session is gone", async () => {
    document.cookie = "cdorneles-session=1";
    const service = createMockService({
      getSession: vi.fn().mockResolvedValue(null),
      getCurrentUser: vi.fn().mockResolvedValue(null),
    });
    stubLocation("/dashboard");

    render(
      <AuthProvider service={service}>
        <SessionStateProbe />
      </AuthProvider>,
    );

    await waitFor(() => expect(window.location.href).toContain("/login"));
  });

  it("does not redirect a truly anonymous visitor on bootstrap", async () => {
    const service = createMockService({
      getSession: vi.fn().mockResolvedValue(null),
      getCurrentUser: vi.fn().mockResolvedValue(null),
    });
    stubLocation("/forgot-password");

    render(
      <AuthProvider service={service}>
        <SessionStateProbe />
      </AuthProvider>,
    );

    await waitFor(() => expect(screen.getByTestId("probe")).toHaveTextContent("anonymous:active"));
    expect(window.location.href).toBe("");
  });

  it("does not redirect a stale session away from a public auth route", async () => {
    document.cookie = "cdorneles-session=1";
    const service = createMockService({
      getSession: vi.fn().mockResolvedValue(null),
      getCurrentUser: vi.fn().mockResolvedValue(null),
    });
    stubLocation("/forgot-password");

    render(
      <AuthProvider service={service}>
        <SessionStateProbe />
      </AuthProvider>,
    );

    await waitFor(() => expect(screen.getByTestId("probe")).toHaveTextContent("anonymous:active"));
    expect(window.location.href).toBe("");
  });
});

describe("reauthentication", () => {
  it("returns to active after reauthenticating", async () => {
    const service = createMockService({
      getSession: vi.fn().mockResolvedValue(createMockSession()),
      getCurrentUser: vi.fn().mockResolvedValue(createMockUser()),
      login: vi.fn().mockResolvedValue(createMockSession({ id: "s2" })),
    });
    const signal = createSessionSignal();
    const { Capture, current } = captureAuth();

    render(
      <AuthProvider service={service} sessionSignal={signal}>
        <Capture />
      </AuthProvider>,
    );
    await waitFor(() => expect(current().status).toBe("authenticated"));

    signal.notifyExpired();
    await waitFor(() => expect(current().sessionState).toBe("expired"));

    await act(async () => {
      await current().reauthenticate({ email: "user@example.com", password: "pw" });
    });

    expect(current().sessionState).toBe("active");
    expect(current().status).toBe("authenticated");
    expect(current().session?.id).toBe("s2");
  });

  it("returns to active after completing the reauthentication MFA step", async () => {
    const service = createMockService({
      getSession: vi.fn().mockResolvedValue(createMockSession()),
      getCurrentUser: vi.fn().mockResolvedValue(createMockUser()),
      completeMfa: vi.fn().mockResolvedValue(createMockSession({ id: "s3" })),
    });
    const signal = createSessionSignal();
    const { Capture, current } = captureAuth();

    render(
      <AuthProvider service={service} sessionSignal={signal}>
        <Capture />
      </AuthProvider>,
    );
    await waitFor(() => expect(current().status).toBe("authenticated"));

    signal.notifyExpired();
    await waitFor(() => expect(current().sessionState).toBe("expired"));

    await act(async () => {
      await current().completeReauthMfa({ challengeId: "c1", code: "123456" });
    });

    expect(current().sessionState).toBe("active");
    expect(current().status).toBe("authenticated");
    expect(current().session?.id).toBe("s3");
  });

  it("propagates MfaRequiredError without marking the session active or navigating", async () => {
    const service = createMockService({
      getSession: vi.fn().mockResolvedValue(createMockSession()),
      getCurrentUser: vi.fn().mockResolvedValue(createMockUser()),
      login: vi.fn().mockRejectedValue(new MfaRequiredError()),
    });
    const signal = createSessionSignal();
    stubLocation("/dashboard");
    const { Capture, current } = captureAuth();

    render(
      <AuthProvider service={service} sessionSignal={signal}>
        <Capture />
      </AuthProvider>,
    );
    await waitFor(() => expect(current().status).toBe("authenticated"));

    signal.notifyExpired();
    await waitFor(() => expect(current().sessionState).toBe("expired"));

    let caught: unknown;
    await act(async () => {
      try {
        await current().reauthenticate({ email: "user@example.com", password: "pw" });
      } catch (error) {
        caught = error;
      }
    });

    // The dialog switches to its MFA step in place; the provider must not
    // navigate (which would discard the page this flow exists to preserve).
    expect(caught).toBeInstanceOf(MfaRequiredError);
    expect(current().sessionState).toBe("expired");
    expect(current().status).toBe("authenticated");
    expect(window.location.href).toBe("");
  });
});

describe("renewSession failure", () => {
  it("marks the session expired when a dead session is renewed and no rejection leaks", async () => {
    const rejections: unknown[] = [];
    const onRejection = (reason: unknown) => {
      rejections.push(reason);
    };
    process.on("unhandledRejection", onRejection);

    try {
      const error = new ApiError("no", { status: 401 });
      const service = createMockService({
        getSession: vi.fn().mockResolvedValue(createMockSession()),
        getCurrentUser: vi.fn().mockResolvedValue(createMockUser()),
        renewSession: vi.fn().mockRejectedValue(error),
      });
      stubLocation("/dashboard");
      const { Capture, current } = captureAuth();

      render(
        <AuthProvider service={service}>
          <Capture />
        </AuthProvider>,
      );
      await waitFor(() => expect(current().status).toBe("authenticated"));

      let caught: unknown;
      await act(async () => {
        try {
          await current().renewSession();
        } catch (renewError) {
          caught = renewError;
        }
      });

      // The failure is rethrown for the caller, but the dead session must also
      // move the provider to "expired" so the dialog can open.
      expect(caught).toBe(error);
      expect(current().sessionState).toBe("expired");
      expect(window.location.href).toBe("");

      // Give Node a real turn to surface any unhandled rejection.
      await new Promise((resolve) => {
        setTimeout(resolve, 0);
      });
      expect(rejections).toHaveLength(0);
    } finally {
      process.off("unhandledRejection", onRejection);
    }
  });

  it("rethrows a non-401 failure without touching the session state", async () => {
    const error = new ApiError("boom", { status: 500 });
    const service = createMockService({
      getSession: vi.fn().mockResolvedValue(createMockSession()),
      getCurrentUser: vi.fn().mockResolvedValue(createMockUser()),
      renewSession: vi.fn().mockRejectedValue(error),
    });
    const { Capture, current } = captureAuth();

    render(
      <AuthProvider service={service}>
        <Capture />
      </AuthProvider>,
    );
    await waitFor(() => expect(current().status).toBe("authenticated"));

    let caught: unknown;
    await act(async () => {
      try {
        await current().renewSession();
      } catch (renewError) {
        caught = renewError;
      }
    });

    expect(caught).toBe(error);
    expect(current().sessionState).toBe("active");
    expect(current().status).toBe("authenticated");
  });
});
