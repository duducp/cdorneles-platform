import "@testing-library/jest-dom/vitest";

import { ThemeProvider } from "@cdorneles/theme";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { useAuthMock, pushMock, replaceMock } = vi.hoisted(() => ({
  useAuthMock: vi.fn(),
  pushMock: vi.fn(),
  replaceMock: vi.fn(),
}));

vi.mock("@cdorneles/auth", () => ({
  useAuth: useAuthMock,
  useRedirectIfAuthenticated: () => true,
  resolvePostAuthRedirect: () => "/dashboard",
  describeAuthError: (error: unknown, fallback: string) =>
    error instanceof Error ? error.message : fallback,
  AuthNotConfiguredError: class AuthNotConfiguredError extends Error {},
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: pushMock, replace: replaceMock }),
}));

import { MfaPage } from "./mfa-page";

describe("MfaPage", () => {
  let logout: ReturnType<typeof vi.fn>;
  let completeMfa: ReturnType<typeof vi.fn>;
  let listMfaFactors: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();
    logout = vi.fn().mockResolvedValue(undefined);
    completeMfa = vi.fn().mockResolvedValue(undefined);
    listMfaFactors = vi.fn().mockResolvedValue({ email: true, totp: false });
    const createMfaChallenge = vi.fn().mockResolvedValue({ challengeId: "challenge-1" });
    useAuthMock.mockReturnValue({
      service: { listMfaFactors, createMfaChallenge },
      completeMfa,
      logout,
    });
    Object.defineProperty(window, "location", {
      value: { href: "", search: "" },
      writable: true,
      configurable: true,
    });
  });

  it("logs out and returns to /login when the form's cancel button is clicked", async () => {
    const user = userEvent.setup();
    render(
      <ThemeProvider>
        <MfaPage />
      </ThemeProvider>,
    );

    await user.click(await screen.findByRole("button", { name: /^cancelar$/i }));

    expect(logout).toHaveBeenCalledTimes(1);
    expect(completeMfa).not.toHaveBeenCalled();
    expect(pushMock).not.toHaveBeenCalled();
    expect(replaceMock).not.toHaveBeenCalled();
    await waitFor(() => {
      expect(window.location.href).toBe("/login");
    });
  });

  it("still returns to /login when logout rejects", async () => {
    logout.mockRejectedValue(new Error("session already gone"));
    const user = userEvent.setup();
    render(
      <ThemeProvider>
        <MfaPage />
      </ThemeProvider>,
    );

    await user.click(await screen.findByRole("button", { name: /^cancelar$/i }));

    expect(logout).toHaveBeenCalledTimes(1);
    await waitFor(() => {
      expect(window.location.href).toBe("/login");
    });
  });

  it("offers cancel in the bootstrap-error state and discards the challenge", async () => {
    listMfaFactors.mockRejectedValue(new Error("boom"));
    const user = userEvent.setup();
    render(
      <ThemeProvider>
        <MfaPage />
      </ThemeProvider>,
    );

    const cancel = await screen.findByRole("button", { name: /^cancelar$/i });
    expect(screen.getByRole("alert")).toHaveTextContent(/erro ao iniciar desafio mfa/i);

    await user.click(cancel);

    expect(logout).toHaveBeenCalledTimes(1);
    await waitFor(() => {
      expect(window.location.href).toBe("/login");
    });
  });
});
