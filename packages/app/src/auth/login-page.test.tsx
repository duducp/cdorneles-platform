import "@testing-library/jest-dom/vitest";

import { ThemeProvider } from "@cdorneles/theme";
import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderToString } from "react-dom/server";
import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";

const { pushMock, replaceMock, oneTapProps, loginMock } = vi.hoisted(() => ({
  pushMock: vi.fn(),
  replaceMock: vi.fn(),
  loginMock: vi.fn(),
  oneTapProps: {
    current: null as null | {
      buttonText?: string;
      buttonParentRef?: { current: HTMLDivElement | null };
      onError: (error: unknown) => void;
      onSuccess?: () => void;
      onStart?: () => void;
    },
  },
}));

vi.mock("@cdorneles/auth", () => ({
  useAuth: () => ({
    login: loginMock,
    status: "anonymous",
  }),
  useRedirectIfAuthenticated: () => true,
  resolvePostAuthRedirect: () => "/p",
  MfaRequiredError: class MfaRequiredError extends Error {},
}));

vi.mock("./google-one-tap", () => ({
  GoogleOneTap: (props: Record<string, unknown>) => {
    oneTapProps.current = props as unknown as NonNullable<typeof oneTapProps.current>;
    return null;
  },
  describeOneTapError: (error: unknown) => `mapped:${String(error)}`,
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: replaceMock, push: pushMock }),
}));

import { LoginPage } from "./login-page";
import { MfaRequiredError } from "@cdorneles/auth";

function renderPage() {
  return render(
    <ThemeProvider>
      <LoginPage />
    </ThemeProvider>,
  );
}

describe("LoginPage", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  beforeEach(() => {
    localStorage.clear();
    oneTapProps.current = null;
    loginMock.mockReset().mockResolvedValue(undefined);
    vi.clearAllMocks();
    loginMock.mockResolvedValue(undefined);
    vi.stubEnv("NEXT_PUBLIC_GOOGLE_CLIENT_ID", "client-id.apps.googleusercontent.com");
    window.history.replaceState({}, "", "/login");
  });

  it("shows 'Bem vindo' when there is no previous login", () => {
    renderPage();

    expect(screen.getByRole("heading", { name: "Bem vindo" })).toBeInTheDocument();
  });

  it("keeps 'Bem vindo' when nothing is stored after hydration", async () => {
    renderPage();

    expect(await screen.findByRole("heading", { name: "Bem vindo" })).toBeInTheDocument();
  });

  it("prerenders the neutral heading even when a method is stored", () => {
    localStorage.setItem("cdorneles-last-login-method", "email");

    const html = renderToString(
      <ThemeProvider>
        <LoginPage />
      </ThemeProvider>,
    );

    expect(html).toContain("Bem vindo");
    expect(html).not.toContain("Bem-vindo de volta");
  });

  it("shows 'Bem-vindo de volta' when there is a previous login", () => {
    localStorage.setItem("cdorneles-last-login-method", "email");
    renderPage();

    expect(screen.getByRole("heading", { name: "Bem-vindo de volta" })).toBeInTheDocument();
  });

  it("mounts the Google slot container and hands it to One Tap when enabled", () => {
    renderPage();

    expect(oneTapProps.current).not.toBeNull();
    expect(oneTapProps.current?.buttonParentRef?.current).toBeInstanceOf(HTMLDivElement);
    expect(screen.getByText("OU CONTINUE COM")).toBeInTheDocument();
  });

  it("asks Google for the 'signin_with' label by default", () => {
    renderPage();

    expect(oneTapProps.current?.buttonText).toBe("signin_with");
  });

  it("asks Google for the 'continue_with' label when last login was Google", () => {
    localStorage.setItem("cdorneles-last-login-method", "google");
    renderPage();

    expect(oneTapProps.current?.buttonText).toBe("continue_with");
  });

  it("does not render the terms footer text", () => {
    renderPage();

    expect(screen.queryByText(/Termos de Uso/)).not.toBeInTheDocument();
  });

  it("records the Google method when One Tap starts", () => {
    renderPage();

    expect(oneTapProps.current).not.toBeNull();
    act(() => {
      oneTapProps.current?.onStart?.();
    });

    expect(localStorage.getItem("cdorneles-last-login-method")).toBe("google");
  });

  it("routes a One Tap MFA challenge to the MFA page", async () => {
    renderPage();

    expect(oneTapProps.current).not.toBeNull();
    act(() => {
      oneTapProps.current?.onError(new MfaRequiredError());
    });

    expect(pushMock).toHaveBeenCalledWith("/mfa?redirect=%2Fp");
  });

  it("maps other One Tap failures to a display message", async () => {
    renderPage();

    expect(oneTapProps.current).not.toBeNull();
    act(() => {
      oneTapProps.current?.onError(new Error("boom"));
    });

    expect(pushMock).not.toHaveBeenCalled();
    expect(await screen.findByText("mapped:Error: boom")).toBeInTheDocument();
  });

  it("shows the loading overlay while One Tap validates and clears it on error", async () => {
    renderPage();

    expect(oneTapProps.current).not.toBeNull();
    act(() => {
      oneTapProps.current?.onStart?.();
    });
    expect(await screen.findByText("Entrando…")).toBeInTheDocument();

    act(() => {
      oneTapProps.current?.onError?.(new Error("boom"));
    });
    expect(screen.queryByText("Entrando…")).not.toBeInTheDocument();
  });

  it("clears the loading overlay and navigates when One Tap succeeds", async () => {
    renderPage();

    expect(oneTapProps.current).not.toBeNull();
    act(() => {
      oneTapProps.current?.onStart?.();
    });
    expect(await screen.findByText("Entrando…")).toBeInTheDocument();

    act(() => {
      oneTapProps.current?.onSuccess?.();
    });
    expect(screen.queryByText("Entrando…")).not.toBeInTheDocument();
    expect(replaceMock).toHaveBeenCalledWith("/p");
  });

  it("hides Google when no client id is configured", () => {
    vi.stubEnv("NEXT_PUBLIC_GOOGLE_CLIENT_ID", "");
    renderPage();

    expect(oneTapProps.current).toBeNull();
    expect(screen.queryByText("OU CONTINUE COM")).not.toBeInTheDocument();
  });

  it("hides Google entirely when the kill switch is off", () => {
    vi.stubEnv("NEXT_PUBLIC_GOOGLE_AUTH_ENABLED", "false");
    renderPage();

    expect(oneTapProps.current).toBeNull();
    expect(screen.queryByText("OU CONTINUE COM")).not.toBeInTheDocument();
  });

  it("logs in with the turnstile token minted by the widget", async () => {
    const user = userEvent.setup();
    renderPage();

    await user.type(screen.getByLabelText("E-mail"), "user@example.com");
    await user.type(screen.getByLabelText("Senha"), "secret");
    await user.click(screen.getByRole("button", { name: "Entrar" }));

    await waitFor(() =>
      expect(loginMock).toHaveBeenCalledWith({
        email: "user@example.com",
        password: "secret",
        turnstileToken: "test-token",
      }),
    );
  });

  it("announces the MFA session-expired notice carried by the /mfa redirect", async () => {
    window.history.replaceState({}, "", "/login?notice=session-expired");
    renderPage();

    expect(await screen.findByRole("alert")).toHaveTextContent(
      /Fa\u00e7a login novamente para iniciar a verifica\u00e7\u00e3o em duas etapas/i,
    );
  });

  it("shows the configuration message and skips login without a site key", async () => {
    vi.stubEnv("NEXT_PUBLIC_TURNSTILE_SITE_KEY", "");
    const user = userEvent.setup();
    renderPage();

    await user.type(screen.getByLabelText("E-mail"), "user@example.com");
    await user.type(screen.getByLabelText("Senha"), "secret");
    await user.click(screen.getByRole("button", { name: "Entrar" }));

    expect(
      await screen.findByText("Verificação de segurança não configurada neste ambiente."),
    ).toBeInTheDocument();
    expect(loginMock).not.toHaveBeenCalled();
  });
});
