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
  resolvePostAuthRedirect: () => "/p",
  describeAuthError: (error: unknown, fallback: string) =>
    error instanceof Error ? error.message : fallback,
  AuthNotConfiguredError: class AuthNotConfiguredError extends Error {},
  // isUnauthorized is imported from @cdorneles/api-client by MfaPage — the
  // real implementation runs here on purpose, so classification is under test.
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

  it("starts the challenge without a turnstile token", async () => {
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

    await waitFor(() => expect(createMfaChallenge).toHaveBeenCalledTimes(1));
    expect(createMfaChallenge).toHaveBeenCalledWith({ factor: "email" });
  });

  it("completes the MFA challenge without a turnstile token", async () => {
    const user = userEvent.setup();
    render(
      <ThemeProvider>
        <MfaPage />
      </ThemeProvider>,
    );

    const inputs = await screen.findAllByLabelText(/código de verificação/i);
    await user.click(inputs[0]);
    await user.keyboard("123456");

    await waitFor(() => expect(completeMfa).toHaveBeenCalledTimes(1));
    expect(completeMfa).toHaveBeenCalledWith({
      challengeId: "challenge-1",
      code: "123456",
    });
  });

  it("keeps the visitor on the page when the bootstrap says more factors are required", async () => {
    // user_more_factors_required (401) is the pending-MFA state itself — the
    // session is alive. Treating it as a dead session would sign the visitor
    // out in the middle of the challenge they are meant to complete.
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

    expect(await screen.findByRole("alert")).toHaveTextContent(/erro ao iniciar desafio mfa/i);
    expect(logout).not.toHaveBeenCalled();
    expect(window.location.href).toBe("");
  });

  it("redirects to /login with a session-expired notice when the bootstrap session is really gone", async () => {
    // The pending-MFA session is gone (or was never handed over): the MFA flow
    // cannot proceed, so the page must sign out and return the visitor to the
    // login screen instead of showing a dead end.
    const ApiErrorCtor = (await import("@cdorneles/api-client")).ApiError;
    listMfaFactors.mockRejectedValue(
      new ApiErrorCtor("Unauthorized", {
        code: "user_unauthorized",
        status: 401,
      }),
    );
    render(
      <ThemeProvider>
        <MfaPage />
      </ThemeProvider>,
    );

    await waitFor(() => {
      expect(window.location.href).toBe("/login?notice=session-expired&redirect=%2Fp");
    });
    expect(logout).toHaveBeenCalledTimes(1);
    expect(completeMfa).not.toHaveBeenCalled();
  });
});
