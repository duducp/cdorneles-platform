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
  isUnauthorized: (error: unknown) =>
    !!error &&
    typeof error === "object" &&
    "status" in error &&
    (error as { status?: number }).status === 401,
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

  it("keeps the challenge form and shows an inline alert when the submitted code is rejected", async () => {
    completeMfa.mockRejectedValue(new Error("Código inválido."));
    const user = userEvent.setup();
    render(
      <ThemeProvider>
        <MfaPage />
      </ThemeProvider>,
    );

    const inputs = await screen.findAllByLabelText(/código de verificação/i);
    await user.click(inputs[0]);
    await user.keyboard("123456");

    await waitFor(() => {
      expect(screen.getByRole("alert")).toHaveTextContent(/código inválido/i);
    });
    // The form must survive a rejected code: pin inputs, submit and cancel stay.
    expect(screen.getAllByLabelText(/código de verificação/i)).toHaveLength(6);
    expect(screen.getByRole("button", { name: /verificar código/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^cancelar$/i })).toBeInTheDocument();
  });

  it("renders the bootstrap error alert before the heading", async () => {
    listMfaFactors.mockRejectedValue(new Error("boom"));
    render(
      <ThemeProvider>
        <MfaPage />
      </ThemeProvider>,
    );

    const alert = await screen.findByRole("alert");
    expect(alert.parentElement?.firstElementChild).toBe(alert);
    expect(
      screen.getByRole("heading", { name: /verificação em duas etapas/i }),
    ).toBeInTheDocument();
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

  it("starts the challenge with the turnstile token", async () => {
    const createMfaChallenge = vi.fn().mockResolvedValue({ challengeId: "challenge-1" });
    useAuthMock.mockReturnValue({
      service: { listMfaFactors, createMfaChallenge },
      completeMfa,
      logout,
    });
    render(
      <ThemeProvider>
        <MfaPage />
      </ThemeProvider>,
    );

    await waitFor(() =>
      expect(createMfaChallenge).toHaveBeenCalledWith({
        factor: "email",
        turnstileToken: "test-token",
      }),
    );
  });

  it("completes the MFA challenge with the turnstile token", async () => {
    const user = userEvent.setup();
    render(
      <ThemeProvider>
        <MfaPage />
      </ThemeProvider>,
    );

    const inputs = await screen.findAllByLabelText(/código de verificação/i);
    await user.click(inputs[0]);
    await user.keyboard("123456");

    await waitFor(() =>
      expect(completeMfa).toHaveBeenCalledWith({
        challengeId: "challenge-1",
        code: "123456",
        turnstileToken: "test-token",
      }),
    );
  });

  it("redirects to /login with a session-expired notice when the bootstrap 401s", async () => {
    // The pending-MFA session is gone (or was never handed over): the MFA flow
    // cannot proceed, so the page must sign out and return the visitor to the
    // login screen instead of showing a dead end.
    const ApiErrorCtor = (await import("@cdorneles/api-client")).ApiError;
    listMfaFactors.mockRejectedValue(
      new ApiErrorCtor("More factors are required", {
        code: "user_more_factors_required",
        status: 401,
      }),
    );
    render(
      <ThemeProvider>
        <MfaPage />
      </ThemeProvider>,
    );

    await waitFor(() => {
      expect(window.location.href).toBe("/login?notice=session-expired&redirect=%2Fdashboard");
    });
    expect(logout).toHaveBeenCalledTimes(1);
    expect(completeMfa).not.toHaveBeenCalled();
  });

  it("shows the Turnstile bootstrap failure and keeps the cancel path", async () => {
    listMfaFactors.mockResolvedValue({ email: true, totp: false });
    const createMfaChallenge = vi.fn().mockResolvedValue({ challengeId: "challenge-1" });
    useAuthMock.mockReturnValue({
      service: { listMfaFactors, createMfaChallenge },
      completeMfa,
      logout,
    });
    // Fail the token: clear the site key so nextToken rejects as unconfigured.
    const previous = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;
    process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY = "";
    try {
      render(
        <ThemeProvider>
          <MfaPage />
        </ThemeProvider>,
      );

      expect(
        await screen.findByText("Verificação de segurança não configurada neste ambiente."),
      ).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /^cancelar$/i })).toBeInTheDocument();
    } finally {
      process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY = previous;
    }
  });
});
