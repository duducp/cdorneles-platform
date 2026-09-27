import "@testing-library/jest-dom/vitest";

import { ThemeProvider } from "@cdorneles/theme";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { useAuthMock, getParamMock } = vi.hoisted(() => ({
  useAuthMock: vi.fn(),
  getParamMock: vi.fn(),
}));

vi.mock("@cdorneles/auth", () => ({
  useAuth: useAuthMock,
  useRedirectIfAuthenticated: () => true,
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  useSearchParams: () => ({ get: getParamMock }),
}));

import { ResetPasswordPage } from "./reset-password-page";

function renderPage() {
  return render(
    <ThemeProvider>
      <ResetPasswordPage />
    </ThemeProvider>,
  );
}

describe("ResetPasswordPage", () => {
  let confirmPasswordRecovery: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();
    confirmPasswordRecovery = vi.fn().mockResolvedValue(undefined);
    useAuthMock.mockReturnValue({
      service: { confirmPasswordRecovery },
    });
    getParamMock.mockImplementation((key: string) =>
      key === "userId" ? "u1" : key === "secret" ? "the-secret" : null,
    );
  });

  it("confirms recovery with the turnstile token", async () => {
    const user = userEvent.setup();
    renderPage();

    await user.type(await screen.findByLabelText(/^nova senha/i), "senhasegura1");
    await user.type(screen.getByLabelText(/^confirmar nova senha/i), "senhasegura1");
    await user.click(screen.getByRole("button", { name: /redefinir senha/i }));

    await waitFor(() =>
      expect(confirmPasswordRecovery).toHaveBeenCalledWith({
        userId: "u1",
        secret: "the-secret",
        password: "senhasegura1",
        turnstileToken: "test-token",
      }),
    );
  });

  it("shows the invalid-link error and does not render the form without a userId", async () => {
    getParamMock.mockReturnValue(null);
    renderPage();

    expect(await screen.findByText(/link de recuperação inválido/i)).toBeInTheDocument();
    expect(screen.queryByLabelText(/nova senha/i)).not.toBeInTheDocument();
    expect(confirmPasswordRecovery).not.toHaveBeenCalled();
  });
});
