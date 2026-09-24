import "@testing-library/jest-dom/vitest";

import { ApiError } from "@cdorneles/api-client";
import { ThemeProvider, useAppColorScheme } from "@cdorneles/theme";
import { act, render, screen, waitFor } from "@testing-library/react";
import { createRef, useEffect } from "react";
import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";

import { GoogleOneTap, describeOneTapError, readIdTokenEmail } from "./google-one-tap";

const { loginWithOneTapMock } = vi.hoisted(() => ({ loginWithOneTapMock: vi.fn() }));

vi.mock("@cdorneles/auth", () => ({
  useAuth: () => ({ loginWithOneTap: loginWithOneTapMock }),
}));

type InitConfig = {
  client_id: string;
  callback: (response: { credential?: string }) => void;
};

type RenderButtonCall = { parent: HTMLElement; options: Record<string, unknown> };

const initCalls: InitConfig[] = [];
const renderButtonCalls: RenderButtonCall[] = [];

// A minimal GSI stub: initialize records its config; renderButton is
// observable. Installing it before render makes loadGsiScript resolve
// immediately (the SDK is "already present"), which is how the callback flows
// are exercised — jsdom never actually loads external scripts.
function installGsi() {
  (window as unknown as { google?: unknown }).google = {
    accounts: {
      id: {
        initialize: (config: InitConfig) => {
          initCalls.push(config);
        },
        prompt: () => {},
        renderButton: (parent: HTMLElement, options: Record<string, unknown>) => {
          renderButtonCalls.push({ parent, options });
        },
      },
    },
  };
}

function renderOneTap(
  overrides?: Partial<{
    enabled: boolean;
    clientId: string;
    buttonParent: boolean;
    buttonText: "signin_with" | "continue_with";
    colorScheme: "light" | "dark";
    onCredential: (idToken: string) => void;
    onStart: () => void;
  }>,
) {
  const onSuccess = vi.fn();
  const onError = vi.fn();
  const onStart = vi.fn();
  const buttonParentRef = createRef<HTMLDivElement>();
  const withParent = overrides?.buttonParent ?? true;
  const initialScheme = overrides?.colorScheme;

  // Surface Mantine's setter so a test can toggle the scheme after mount.
  const schemeControl: { set: ((scheme: "light" | "dark" | "auto") => void) | null } = {
    set: null,
  };
  function SchemeCapture() {
    const { setColorScheme } = useAppColorScheme();
    useEffect(() => {
      schemeControl.set = setColorScheme;
    }, [setColorScheme]);
    return null;
  }

  render(
    <ThemeProvider
      organizationDefault={initialScheme}
      respectSystemPreference={initialScheme ? false : undefined}
    >
      <SchemeCapture />
      {withParent ? <div ref={buttonParentRef} data-testid="google-button" /> : null}
      <GoogleOneTap
        clientId={overrides?.clientId ?? "client-id.apps.googleusercontent.com"}
        enabled={overrides?.enabled ?? true}
        buttonParentRef={withParent ? buttonParentRef : undefined}
        buttonText={overrides?.buttonText}
        onSuccess={onSuccess}
        onError={onError}
        onCredential={overrides?.onCredential}
        onStart={overrides?.onStart ?? onStart}
      />
    </ThemeProvider>,
  );
  return {
    onSuccess,
    onError,
    onStart,
    buttonParentRef,
    setColorScheme: (scheme: "light" | "dark" | "auto") => {
      if (!schemeControl.set) throw new Error("color scheme control is not ready");
      act(() => schemeControl.set?.(scheme));
    },
  };
}

beforeEach(() => {
  loginWithOneTapMock.mockReset();
  initCalls.length = 0;
  renderButtonCalls.length = 0;
  localStorage.clear();
  delete (window as unknown as { google?: unknown }).google;
});

afterEach(() => {
  document.querySelectorAll('script[src*="accounts.google.com"]').forEach((node) => {
    node.remove();
  });
});

describe("GoogleOneTap", () => {
  it("initializes GSI and renders Google's button into the container", async () => {
    installGsi();
    const { onError } = renderOneTap();

    await waitFor(() => expect(renderButtonCalls).toHaveLength(1));

    expect(initCalls).toHaveLength(1);
    expect(initCalls[0].client_id).toBe("client-id.apps.googleusercontent.com");
    expect(renderButtonCalls[0].parent).toBe(screen.getByTestId("google-button"));
    expect(renderButtonCalls[0].options).toMatchObject({
      type: "standard",
      theme: "outline",
      size: "large",
      shape: "rectangular",
      text: "signin_with",
      locale: "pt-BR",
      width: 200,
    });
    expect(renderButtonCalls[0].options.client_id).toBeUndefined();
    expect(onError).not.toHaveBeenCalled();
  });

  it("renders the button with the dark theme under a dark scheme", async () => {
    installGsi();
    renderOneTap({ colorScheme: "dark" });

    await waitFor(() => expect(renderButtonCalls).toHaveLength(1));

    expect(renderButtonCalls[0].options.theme).toBe("filled_black");
  });

  it("re-renders the button with the new theme when the scheme toggles", async () => {
    installGsi();
    const { setColorScheme } = renderOneTap();

    await waitFor(() => expect(renderButtonCalls).toHaveLength(1));
    expect(renderButtonCalls[0].options.theme).toBe("outline");

    setColorScheme("dark");

    await waitFor(() => expect(renderButtonCalls).toHaveLength(2));
    expect(renderButtonCalls[1].options.theme).toBe("filled_black");
    expect(initCalls).toHaveLength(1);
  });

  it("clamps the button width to Google's 200–400 range", async () => {
    installGsi();
    renderOneTap();
    const container = screen.getByTestId("google-button");
    Object.defineProperty(container, "clientWidth", { value: 500, configurable: true });

    await waitFor(() => expect(renderButtonCalls).toHaveLength(1));

    expect(renderButtonCalls[0].options.width).toBe(400);
  });

  it("uses the requested button label", async () => {
    installGsi();
    renderOneTap({ buttonText: "continue_with" });

    await waitFor(() => expect(renderButtonCalls).toHaveLength(1));

    expect(renderButtonCalls[0].options.text).toBe("continue_with");
  });

  it("does not render the button when no container is provided", async () => {
    installGsi();
    renderOneTap({ buttonParent: false });

    await waitFor(() => expect(initCalls).toHaveLength(1));

    expect(renderButtonCalls).toHaveLength(0);
  });

  it("never initializes or renders the button while disabled", async () => {
    installGsi();
    renderOneTap({ enabled: false });

    await new Promise((resolve) => setTimeout(resolve, 50));

    expect(initCalls).toHaveLength(0);
    expect(renderButtonCalls).toHaveLength(0);
  });

  it("exchanges the ID token for a session and reports success", async () => {
    installGsi();
    loginWithOneTapMock.mockResolvedValue({ id: "s1", userId: "u1", expiresAt: "2030" });
    const { onSuccess, onError } = renderOneTap();

    await waitFor(() => expect(initCalls).toHaveLength(1));
    initCalls[0].callback({ credential: "the-jwt" });

    await waitFor(() => expect(onSuccess).toHaveBeenCalledOnce());
    expect(loginWithOneTapMock).toHaveBeenCalledWith({ idToken: "the-jwt" });
    expect(onError).not.toHaveBeenCalled();
  });

  it("signals the start as soon as the credential arrives", async () => {
    installGsi();
    loginWithOneTapMock.mockResolvedValue({ id: "s1", userId: "u1", expiresAt: "2030" });
    const { onStart } = renderOneTap();

    await waitFor(() => expect(initCalls).toHaveLength(1));
    initCalls[0].callback({ credential: "the-jwt" });

    // Called synchronously inside the callback, before the exchange resolves.
    expect(onStart).toHaveBeenCalledOnce();
  });

  it("forwards the raw error to onError", async () => {
    installGsi();
    const apiError = new ApiError("no platform user", {
      code: "unknown_email",
      status: 403,
    });
    loginWithOneTapMock.mockRejectedValue(apiError);
    const { onError } = renderOneTap();

    await waitFor(() => expect(initCalls).toHaveLength(1));
    initCalls[0].callback({ credential: "the-jwt" });

    await waitFor(() => expect(onError).toHaveBeenCalledOnce());
    expect(onError).toHaveBeenCalledWith(apiError);
  });

  it("reports null when the GSI script fails to load", async () => {
    const { onError } = renderOneTap();

    // No window.google stub: the component injects the script tag, which
    // jsdom never loads. Firing its error event simulates the failure.
    const script = await waitFor(() => {
      const node = document.querySelector<HTMLScriptElement>('script[src*="accounts.google.com"]');
      if (!node) throw new Error("GSI script not found");
      return node;
    });
    script.dispatchEvent(new Event("error"));

    await waitFor(() => expect(onError).toHaveBeenCalledOnce());
    expect(onError).toHaveBeenCalledWith(null);
  });

  it("hands the raw token to onCredential instead of logging in", async () => {
    installGsi();
    const onCredential = vi.fn();
    const { onSuccess, onStart } = renderOneTap({ onCredential });

    await waitFor(() => expect(initCalls).toHaveLength(1));
    initCalls[0].callback({ credential: "the-jwt" });

    await waitFor(() => expect(onCredential).toHaveBeenCalledWith("the-jwt"));
    expect(onStart).toHaveBeenCalledOnce();
    expect(loginWithOneTapMock).not.toHaveBeenCalled();
    expect(onSuccess).not.toHaveBeenCalled();
  });

  it("does not signal the start for a credential-less response", async () => {
    installGsi();
    const onCredential = vi.fn();
    const { onStart } = renderOneTap({ onCredential });

    await waitFor(() => expect(initCalls).toHaveLength(1));
    initCalls[0].callback({});

    expect(onStart).not.toHaveBeenCalled();
    expect(onCredential).not.toHaveBeenCalled();
  });

  it("routes a rejected parent exchange to onError", async () => {
    installGsi();
    const apiError = new Error("async boom");
    const onCredential = vi.fn().mockRejectedValue(apiError);
    const { onError } = renderOneTap({ onCredential });

    await waitFor(() => expect(initCalls).toHaveLength(1));
    initCalls[0].callback({ credential: "the-jwt" });

    await waitFor(() => expect(onError).toHaveBeenCalledWith(apiError));
  });
});

describe("describeOneTapError", () => {
  it("maps known causes to specific messages", () => {
    expect(
      describeOneTapError(new ApiError("no platform user", { code: "unknown_email" })),
    ).toContain("Não há conta");
    expect(describeOneTapError(new ApiError("blocked", { code: "user_disabled" }))).toContain(
      "bloqueada",
    );
    expect(describeOneTapError(new ApiError("verify", { code: "email_not_verified" }))).toContain(
      "Confirme o e-mail",
    );
  });

  it("falls back to a generic message", () => {
    expect(describeOneTapError(new Error("boom"))).toContain("Não foi possível entrar");
  });

  it("maps a disabled Google auth response", () => {
    expect(
      describeOneTapError(new ApiError("disabled", { code: "google_auth_disabled" })),
    ).toContain("desativado");
  });
});

describe("readIdTokenEmail", () => {
  it("decodes a URL-safe, unpadded payload (base64url)", () => {
    const standard = btoa(JSON.stringify({ email: "test?@x.com" }));
    const payload = standard.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");

    expect(standard).toMatch(/[/=]/);
    expect(payload).toMatch(/_/);
    expect(readIdTokenEmail(`header.${payload}.signature`)).toBe("test?@x.com");
  });

  it("returns null when the payload is not JSON", () => {
    expect(readIdTokenEmail(`a.${btoa("nope")}.c`)).toBeNull();
  });

  it("returns null when there is no usable payload", () => {
    expect(readIdTokenEmail("not-a-jwt")).toBeNull();
    expect(readIdTokenEmail("a.b")).toBeNull();
    expect(readIdTokenEmail(`a.${btoa("{}")}.c`)).toBeNull();
  });
});
