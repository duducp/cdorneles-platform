import "@testing-library/jest-dom/vitest";

import { ThemeProvider } from "@cdorneles/theme";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { useAuthMock } = vi.hoisted(() => ({
  useAuthMock: vi.fn(),
}));

vi.mock("@cdorneles/auth", () => ({
  useAuth: useAuthMock,
  useRedirectIfAuthenticated: () => true,
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
}));

import { ForgotPasswordPage } from "./forgot-password-page";

describe("ForgotPasswordPage", () => {
  let requestPasswordRecovery: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();
    requestPasswordRecovery = vi.fn().mockResolvedValue(undefined);
    useAuthMock.mockReturnValue({
      service: { requestPasswordRecovery },
    });
  });

  it("requests recovery with the turnstile token", async () => {
    const user = userEvent.setup();
    render(
      <ThemeProvider>
        <ForgotPasswordPage />
      </ThemeProvider>,
    );

    await user.type(await screen.findByLabelText(/e-mail/i), "a@b.com");
    await user.click(screen.getByRole("button", { name: /enviar link de recuperação/i }));

    await waitFor(() =>
      expect(requestPasswordRecovery).toHaveBeenCalledWith(
        expect.objectContaining({
          email: "a@b.com",
          turnstileToken: "test-token",
        }),
      ),
    );
  });

  it("sends the reset-password origin as the redirect url", async () => {
    const user = userEvent.setup();
    render(
      <ThemeProvider>
        <ForgotPasswordPage />
      </ThemeProvider>,
    );

    await user.type(await screen.findByLabelText(/e-mail/i), "a@b.com");
    await user.click(screen.getByRole("button", { name: /enviar link de recuperação/i }));

    await waitFor(() =>
      expect(requestPasswordRecovery).toHaveBeenCalledWith(
        expect.objectContaining({
          redirectUrl: "http://localhost:3000/reset-password",
        }),
      ),
    );
  });

  it("does not call the service when the e-mail is invalid", async () => {
    const user = userEvent.setup();
    render(
      <ThemeProvider>
        <ForgotPasswordPage />
      </ThemeProvider>,
    );

    await user.type(await screen.findByLabelText(/e-mail/i), "not-an-email");
    await user.click(screen.getByRole("button", { name: /enviar link de recuperação/i }));

    expect(requestPasswordRecovery).not.toHaveBeenCalled();
  });
});
