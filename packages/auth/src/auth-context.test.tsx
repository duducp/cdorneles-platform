import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { type ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ApiError } from "@cdorneles/api-client";

import { AuthProvider, SIGNAL_SUPPRESSION_MS, useAuth } from "./auth-context";
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
    loginWithOneTap: vi.fn(),
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

describe("onUserChange", () => {
  it("fires on the identity transition at login and logout, but not on a same-user refresh", async () => {
    const onUserChange = vi.fn();
    const service = createMockService({
      // Bootstrap resolves anonymous; the later refresh resolves the same user.
      getSession: vi.fn().mockResolvedValueOnce(null).mockResolvedValue(createMockSession()),
      getCurrentUser: vi.fn().mockResolvedValue(createMockUser()),
      login: vi.fn().mockResolvedValue(createMockSession()),
      logout: vi.fn().mockResolvedValue(undefined),
    });
    const { Capture, current } = captureAuth();

    render(
      <AuthProvider service={service} onUserChange={onUserChange}>
        <Capture />
      </AuthProvider>,
    );
    await waitFor(() => expect(current().status).toBe("anonymous"));
    expect(onUserChange).not.toHaveBeenCalled();

    // The callback fires from the transition itself as login resolves, before
    // any effect could run — not from a passive effect watching `user`.
    await act(async () => {
      await current().login({ email: "a@b.c", password: "pass" });
    });
    expect(onUserChange).toHaveBeenCalledTimes(1);
    expect(onUserChange).toHaveBeenCalledWith(null, "u1");

    // A refresh of the SAME identity is not a transition.
    onUserChange.mockClear();
    await act(async () => {
      await current().refresh();
    });
    expect(onUserChange).not.toHaveBeenCalled();

    await act(async () => {
      await current().logout();
    });
    expect(onUserChange).toHaveBeenCalledTimes(1);
    expect(onUserChange).toHaveBeenCalledWith("u1", null);
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

  it("reports an already-expired session as active", async () => {
    const service = createMockService({
      getSession: vi
        .fn()
        .mockResolvedValue(
          createMockSession({ expiresAt: new Date(Date.now() - 60_000).toISOString() }),
        ),
      getCurrentUser: vi.fn().mockResolvedValue(createMockUser()),
    });

    render(
      <AuthProvider service={service}>
        <SessionStateProbe />
      </AuthProvider>,
    );

    await waitFor(() =>
      expect(screen.getByTestId("probe")).toHaveTextContent("authenticated:active"),
    );
  });

  it("keeps a session inside the warning window active", async () => {
    const service = createMockService({
      getSession: vi
        .fn()
        .mockResolvedValue(
          createMockSession({ expiresAt: new Date(Date.now() + 60_000).toISOString() }),
        ),
      getCurrentUser: vi.fn().mockResolvedValue(createMockUser()),
    });

    render(
      <AuthProvider service={service}>
        <SessionStateProbe />
      </AuthProvider>,
    );

    // The about-to-expire step lives on `expiryWarning`; `sessionState` only
    // tracks validity, so an in-window session stays active.
    await waitFor(() =>
      expect(screen.getByTestId("probe")).toHaveTextContent("authenticated:active"),
    );
  });

  it("stops polling once the session is known expired", async () => {
    vi.useFakeTimers({ toFake: ["setInterval", "clearInterval"] });
    const getSession = vi.fn().mockResolvedValue(createMockSession());
    const service = createMockService({
      getSession,
      getCurrentUser: vi.fn().mockResolvedValue(createMockUser()),
    });
    const signal = createSessionSignal();
    stubLocation("/dashboard");

    render(
      <AuthProvider service={service} sessionSignal={signal}>
        <SessionStateProbe />
      </AuthProvider>,
    );

    await flushMicrotasks();
    expect(screen.getByTestId("probe")).toHaveTextContent("authenticated:active");
    const callsBefore = getSession.mock.calls.length;

    await act(async () => {
      signal.notifyExpired();
    });
    expect(screen.getByTestId("probe")).toHaveTextContent("authenticated:expired");

    await act(async () => {
      await vi.advanceTimersByTimeAsync(POLL_INTERVAL_MS);
    });
    expect(getSession.mock.calls.length).toBe(callsBefore);
  });

  it("ignores a poll that started before a reauthentication and resolves afterwards", async () => {
    vi.useFakeTimers({ toFake: ["setInterval", "clearInterval"] });
    let resolvePoll!: (value: AuthSession | null) => void;
    const pollPromise = new Promise<AuthSession | null>((resolve) => {
      resolvePoll = resolve;
    });
    const getSession = vi
      .fn()
      .mockResolvedValueOnce(createMockSession())
      .mockReturnValueOnce(pollPromise);
    const service = createMockService({
      getSession,
      getCurrentUser: vi.fn().mockResolvedValue(createMockUser()),
      login: vi.fn().mockResolvedValue(createMockSession({ id: "s2" })),
    });
    stubLocation("/dashboard");
    const { Capture, current } = captureAuth();

    render(
      <AuthProvider service={service}>
        <Capture />
      </AuthProvider>,
    );
    await flushMicrotasks();
    expect(current().status).toBe("authenticated");

    // Fire the poll; its getSession is deliberately left pending.
    await act(async () => {
      await vi.advanceTimersByTimeAsync(POLL_INTERVAL_MS);
    });
    expect(getSession).toHaveBeenCalledTimes(2);

    // Reauthenticate while that poll is still in flight.
    await act(async () => {
      await current().reauthenticate({ email: "user@example.com", password: "pw" });
    });
    expect(current().sessionState).toBe("active");
    expect(current().session?.id).toBe("s2");

    // The stale poll now resolves null. It must not expire the fresh session.
    await act(async () => {
      resolvePoll(null);
      await pollPromise;
    });
    expect(current().sessionState).toBe("active");
    expect(current().status).toBe("authenticated");
  });

  it("redirects on bootstrap when a session cookie was present but the session is gone", async () => {
    document.cookie = "cdorneles-session=1";
    const service = createMockService({
      getSession: vi.fn().mockResolvedValue(null),
      // The real adapter rethrows a 401 from getCurrentUser (it never resolves
      // null), so a stale cookie takes this path via a rejection, not a null.
      getCurrentUser: vi
        .fn()
        .mockRejectedValue(
          new ApiError("session gone", { status: 401, code: "user_unauthorized" }),
        ),
    });
    stubLocation("/dashboard");

    render(
      <AuthProvider service={service}>
        <SessionStateProbe />
      </AuthProvider>,
    );

    await waitFor(() => expect(window.location.href).toContain("/login"));
  });

  it("signs out on bootstrap when the session resolves but the user check is unauthorized", async () => {
    document.cookie = "cdorneles-session=1";
    const service = createMockService({
      getSession: vi.fn().mockResolvedValue(createMockSession()),
      getCurrentUser: vi
        .fn()
        .mockRejectedValue(
          new ApiError("session gone", { status: 401, code: "user_unauthorized" }),
        ),
    });
    stubLocation("/dashboard");

    render(
      <AuthProvider service={service}>
        <SessionStateProbe />
      </AuthProvider>,
    );

    // A confirmed 401 is a sign-out, not a transient failure: navigate to login.
    await waitFor(() => expect(window.location.href).toContain("/login"));
  });

  it("does not redirect on a transient bootstrap failure even with a cookie", async () => {
    document.cookie = "cdorneles-session=1";
    const service = createMockService({
      getSession: vi.fn().mockRejectedValue(new ApiError("network", { status: 500 })),
      getCurrentUser: vi.fn().mockResolvedValue(createMockUser()),
    });
    stubLocation("/dashboard");

    render(
      <AuthProvider service={service}>
        <SessionStateProbe />
      </AuthProvider>,
    );

    await waitFor(() => expect(screen.getByTestId("probe")).toHaveTextContent("anonymous:active"));
    // A failed check (network or server) must not navigate: the session may
    // still be valid and the next load will find it.
    expect(window.location.href).toBe("");
  });

  it("does not redirect a truly anonymous visitor on bootstrap", async () => {
    const service = createMockService({
      getSession: vi.fn().mockResolvedValue(null),
      getCurrentUser: vi
        .fn()
        .mockRejectedValue(
          new ApiError("session gone", { status: 401, code: "user_unauthorized" }),
        ),
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
      getCurrentUser: vi
        .fn()
        .mockRejectedValue(
          new ApiError("session gone", { status: 401, code: "user_unauthorized" }),
        ),
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

  it("redirects to /mfa when the bootstrap session needs more factors", async () => {
    const service = createMockService({
      getSession: vi.fn().mockRejectedValue(new MfaRequiredError()),
      getCurrentUser: vi.fn().mockResolvedValue(null),
    });
    stubLocation("/dashboard");

    render(
      <AuthProvider service={service}>
        <SessionStateProbe />
      </AuthProvider>,
    );

    await waitFor(() => expect(screen.getByTestId("probe")).toHaveTextContent("anonymous:active"));
    expect(window.location.href).toBe("/mfa?redirect=%2Fdashboard");
  });

  it("does not redirect to /mfa when already on the MFA page", async () => {
    const service = createMockService({
      getSession: vi.fn().mockRejectedValue(new MfaRequiredError()),
      getCurrentUser: vi.fn().mockResolvedValue(null),
    });
    stubLocation("/mfa");

    render(
      <AuthProvider service={service}>
        <SessionStateProbe />
      </AuthProvider>,
    );

    await waitFor(() => expect(screen.getByTestId("probe")).toHaveTextContent("anonymous:active"));
    expect(window.location.href).toBe("");
  });
});

describe("expiry warning", () => {
  it("warns at 15 minutes and again at 5 minutes before a long session expires", async () => {
    vi.useFakeTimers();
    const service = createMockService({
      getSession: vi
        .fn()
        .mockResolvedValue(
          createMockSession({ expiresAt: new Date(Date.now() + 30 * 60_000).toISOString() }),
        ),
      getCurrentUser: vi.fn().mockResolvedValue(createMockUser()),
    });
    const { Capture, current } = captureAuth();

    render(
      <AuthProvider service={service}>
        <Capture />
      </AuthProvider>,
    );
    await flushMicrotasks();

    expect(current().status).toBe("authenticated");
    expect(current().expiryWarning).toBe("none");

    // Cross the 15-minute mark.
    await act(async () => {
      await vi.advanceTimersByTimeAsync(15 * 60_000);
    });
    expect(current().expiryWarning).toBe("15m");

    // Cross the 5-minute mark.
    await act(async () => {
      await vi.advanceTimersByTimeAsync(10 * 60_000);
    });
    expect(current().expiryWarning).toBe("5m");
  });

  it("never emits 15m for a session born inside the 15-minute window", async () => {
    vi.useFakeTimers();
    const service = createMockService({
      getSession: vi
        .fn()
        .mockResolvedValue(
          createMockSession({ expiresAt: new Date(Date.now() + 10 * 60_000).toISOString() }),
        ),
      getCurrentUser: vi.fn().mockResolvedValue(createMockUser()),
    });
    const { Capture, current } = captureAuth();

    render(
      <AuthProvider service={service}>
        <Capture />
      </AuthProvider>,
    );
    await flushMicrotasks();
    expect(current().expiryWarning).toBe("none");

    // Inside the 15-minute window but still more than 5 minutes out: no crossing
    // has been observed, so the warning must stay silent (never "15m").
    await act(async () => {
      await vi.advanceTimersByTimeAsync(4 * 60_000);
    });
    expect(current().expiryWarning).toBe("none");

    await act(async () => {
      await vi.advanceTimersByTimeAsync(60_000);
    });
    expect(current().expiryWarning).toBe("5m");
  });

  it("clears the warning once the session expires", async () => {
    vi.useFakeTimers();
    const service = createMockService({
      getSession: vi
        .fn()
        .mockResolvedValue(
          createMockSession({ expiresAt: new Date(Date.now() + 60_000).toISOString() }),
        ),
      getCurrentUser: vi.fn().mockResolvedValue(createMockUser()),
    });
    const { Capture, current } = captureAuth();

    render(
      <AuthProvider service={service}>
        <Capture />
      </AuthProvider>,
    );
    await flushMicrotasks();

    // Born inside the 5-minute window: the warning is already showing.
    expect(current().expiryWarning).toBe("5m");

    // Past the deadline the warning must drop, without waiting for the poll.
    await act(async () => {
      await vi.advanceTimersByTimeAsync(61_000);
    });
    expect(current().expiryWarning).toBe("none");
  });

  it("reschedules from the new expiry when the session is renewed", async () => {
    vi.useFakeTimers();
    // Track the live session so the poll reflects a renewal instead of reviving
    // the expired-expiry session it replaced.
    let activeSession = createMockSession({
      expiresAt: new Date(Date.now() + 30 * 60_000).toISOString(),
    });
    const service = createMockService({
      getSession: vi.fn().mockImplementation(() => Promise.resolve(activeSession)),
      getCurrentUser: vi.fn().mockResolvedValue(createMockUser()),
      renewSession: vi.fn().mockImplementation(() => {
        activeSession = createMockSession({
          id: "s2",
          expiresAt: new Date(Date.now() + 30 * 60_000).toISOString(),
        });
        return Promise.resolve(activeSession);
      }),
    });
    const { Capture, current } = captureAuth();

    render(
      <AuthProvider service={service}>
        <Capture />
      </AuthProvider>,
    );
    await flushMicrotasks();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(15 * 60_000);
    });
    expect(current().expiryWarning).toBe("15m");

    // A new expiry is ~30 minutes out again, so the warning resets to "none"
    // and the old timers are discarded.
    await act(async () => {
      await current().renewSession();
    });
    expect(current().expiryWarning).toBe("none");

    await act(async () => {
      await vi.advanceTimersByTimeAsync(15 * 60_000);
    });
    expect(current().expiryWarning).toBe("15m");
  });

  it("clears the warning on logout", async () => {
    vi.useFakeTimers();
    const service = createMockService({
      getSession: vi
        .fn()
        .mockResolvedValue(
          createMockSession({ expiresAt: new Date(Date.now() + 30 * 60_000).toISOString() }),
        ),
      getCurrentUser: vi.fn().mockResolvedValue(createMockUser()),
      logout: vi.fn().mockResolvedValue(undefined),
    });
    const { Capture, current } = captureAuth();

    render(
      <AuthProvider service={service}>
        <Capture />
      </AuthProvider>,
    );
    await flushMicrotasks();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(15 * 60_000);
    });
    expect(current().expiryWarning).toBe("15m");

    await act(async () => {
      await current().logout();
    });
    expect(current().expiryWarning).toBe("none");
  });

  it("never schedules a delay beyond the setTimeout 32-bit range", async () => {
    // A session ~400 days out (Appwrite's default lifetime is around a year)
    // would overflow setTimeout: the raw delay is clamped to 1ms and fires at
    // once, flashing a warning the session is nowhere near. Assert the invariant
    // directly, since fake timers do not reproduce the runtime clamp.
    const setTimeoutSpy = vi.spyOn(globalThis, "setTimeout");
    const service = createMockService({
      getSession: vi.fn().mockResolvedValue(
        createMockSession({
          expiresAt: new Date(Date.now() + 400 * 24 * 60 * 60_000).toISOString(),
        }),
      ),
      getCurrentUser: vi.fn().mockResolvedValue(createMockUser()),
    });
    const { Capture, current } = captureAuth();

    render(
      <AuthProvider service={service}>
        <Capture />
      </AuthProvider>,
    );
    await flushMicrotasks();

    const MAX_TIMEOUT_MS = 2_147_483_647;
    const delays = setTimeoutSpy.mock.calls.map((call) => Number(call[1] ?? 0));
    expect(delays.length).toBeGreaterThan(0);
    for (const delay of delays) {
      expect(delay).toBeLessThanOrEqual(MAX_TIMEOUT_MS);
    }
    // With a safe capped wait that will not fire, the warning stays silent.
    expect(current().expiryWarning).toBe("none");

    setTimeoutSpy.mockRestore();
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

  it("ignores a stale 401 that arrives inside the suppression window after a reauthentication", async () => {
    const startedAt = Date.now();
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(startedAt);

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

    // A request started before the fresh session landed resolves with a stale
    // 401 a second later. It is inside the suppression window and must not
    // reopen the dialog.
    vi.setSystemTime(startedAt + 1_000);
    await act(async () => {
      signal.notifyExpired();
    });

    expect(current().sessionState).toBe("active");
  });

  it("moves back to expired when a fresh 401 arrives after a successful reauthentication", async () => {
    const startedAt = Date.now();
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(startedAt);

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

    // 1. Drive the provider to expired via the signal.
    signal.notifyExpired();
    await waitFor(() => expect(current().sessionState).toBe("expired"));

    // 2. Reauthenticate successfully — sessionState returns to "active".
    await act(async () => {
      await current().reauthenticate({ email: "user@example.com", password: "pw" });
    });
    expect(current().sessionState).toBe("active");

    // 3. The fresh session dies too, after the suppression window has lapsed.
    //    This is a second, genuine 401 — not a stale request from before reauth
    //    — so it must reopen the dialog.
    vi.setSystemTime(startedAt + SIGNAL_SUPPRESSION_MS + 1);
    await act(async () => {
      signal.notifyExpired();
    });

    await waitFor(() => expect(current().sessionState).toBe("expired"));
  });

  it("keeps the session expired when the reauthentication MFA code is rejected", async () => {
    const failure = new Error("invalid code");
    const service = createMockService({
      getSession: vi.fn().mockResolvedValue(createMockSession()),
      getCurrentUser: vi.fn().mockResolvedValue(createMockUser()),
      completeMfa: vi.fn().mockRejectedValue(failure),
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

    let caught: unknown;
    await act(async () => {
      try {
        await current().completeReauthMfa({ challengeId: "c1", code: "000000" });
      } catch (error) {
        caught = error;
      }
    });

    // A wrong code must not close the dialog or activate a session.
    expect(caught).toBe(failure);
    expect(current().sessionState).toBe("expired");
    expect(current().status).toBe("authenticated");
  });
});

describe("renewSession failure", () => {
  it("marks the session expired when a dead session is renewed", async () => {
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
