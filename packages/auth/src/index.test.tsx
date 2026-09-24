import "@testing-library/jest-dom/vitest";

import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { AuthProvider, useAuth } from "./auth-context";
import { AuthNotConfiguredError, createUnconfiguredAuthService } from "./provider";
import type { AuthService, AuthUser } from "./types";

const user: AuthUser = {
  id: "u1",
  email: "user@example.com",
  name: "User",
  emailVerified: true,
  mfaEnabled: true,
};

function createFakeService(): AuthService {
  return {
    login: vi.fn(async () => ({ id: "s1", userId: "u1", expiresAt: "2030-01-01T00:00:00Z" })),
    loginWithOneTap: vi.fn(
      async () => ({ id: "s1", userId: "u1", expiresAt: "2030-01-01T00:00:00Z" }) as never,
    ),
    completeMfa: vi.fn(async () => ({ id: "s1", userId: "u1", expiresAt: "2030-01-01T00:00:00Z" })),
    listMfaFactors: vi.fn(async () => ({
      totp: false,
      phone: false,
      email: false,
      recoveryCode: false,
    })),
    createMfaChallenge: vi.fn(async () => ({ challengeId: "c1", factor: "email" as const })),
    logout: vi.fn(async () => undefined),
    getSession: vi.fn(async () => ({ id: "s1", userId: "u1", expiresAt: "2030-01-01T00:00:00Z" })),
    renewSession: vi.fn(async () => ({
      id: "s1",
      userId: "u1",
      expiresAt: "2030-01-01T00:00:00Z",
    })),
    getCurrentUser: vi.fn(async () => user),
    requestPasswordRecovery: vi.fn(async () => undefined),
    confirmPasswordRecovery: vi.fn(async () => undefined),
  };
}

describe("unconfigured auth service", () => {
  it("fails loudly for every operation", async () => {
    const service = createUnconfiguredAuthService();
    await expect(service.getCurrentUser()).rejects.toBeInstanceOf(AuthNotConfiguredError);
    await expect(service.login({ email: "a@b.com", password: "x" })).rejects.toBeInstanceOf(
      AuthNotConfiguredError,
    );
  });
});

describe("AuthProvider", () => {
  function Probe() {
    const { user: currentUser, status, login, logout } = useAuth();
    return (
      <div>
        <span data-testid="status">{status}</span>
        <span data-testid="email">{currentUser?.email ?? "none"}</span>
        <button onClick={() => void login({ email: "a@b.com", password: "secret" })}>login</button>
        <button onClick={() => void logout()}>logout</button>
      </div>
    );
  }

  it("restores the session on mount, then updates on logout/login", async () => {
    const service = createFakeService();
    render(
      <AuthProvider service={service}>
        <Probe />
      </AuthProvider>,
    );

    // Starts loading while any existing session is resolved.
    expect(screen.getByTestId("status")).toHaveTextContent("loading");

    // getSession returns a session and getCurrentUser resolves, so the session
    // is restored without a login.
    await screen.findByText("user@example.com");
    expect(screen.getByTestId("status")).toHaveTextContent("authenticated");

    screen.getByRole("button", { name: "logout" }).click();
    await screen.findByText("none");
    expect(screen.getByTestId("status")).toHaveTextContent("anonymous");

    screen.getByRole("button", { name: "login" }).click();
    await screen.findByText("user@example.com");
    expect(screen.getByTestId("status")).toHaveTextContent("authenticated");
  });

  it("throws when the hook is used outside the provider", () => {
    expect(() => render(<Probe />)).toThrow(/AuthProvider/);
  });
});
