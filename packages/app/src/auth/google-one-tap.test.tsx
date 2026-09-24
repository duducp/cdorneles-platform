import "@testing-library/jest-dom/vitest";

import { ApiError } from "@cdorneles/api-client";
import { ThemeProvider } from "@cdorneles/theme";
import { render, waitFor } from "@testing-library/react";
import { createRef, type RefObject } from "react";
import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";

import {
  GoogleOneTap,
  describeOneTapError,
  readIdTokenEmail,
  type GoogleOneTapHandle,
} from "./google-one-tap";

const { loginWithOneTapMock } = vi.hoisted(() => ({ loginWithOneTapMock: vi.fn() }));

vi.mock("@cdorneles/auth", () => ({
  useAuth: () => ({ loginWithOneTap: loginWithOneTapMock }),
}));

type InitConfig = {
  client_id: string;
  callback: (response: { credential?: string }) => void;
};

type PromptListener = (notification: {
  isNotDisplayed?: () => boolean;
  isSkippedMoment?: () => boolean;
}) => void;

const initCalls: InitConfig[] = [];
const promptCalls: number[] = [];
const promptListeners: PromptListener[] = [];

// A minimal GSI stub: initialize records its config; prompt is observable.
// Installing it before render makes loadGsiScript resolve immediately (the
// SDK is "already present"), which is how the callback flows are exercised —
// jsdom never actually loads external scripts.
function installGsi() {
  (window as unknown as { google?: unknown }).google = {
    accounts: {
      id: {
        initialize: (config: InitConfig) => {
          initCalls.push(config);
        },
        prompt: (listener: PromptListener) => {
          promptCalls.push(promptCalls.length);
          if (listener) promptListeners.push(listener);
        },
      },
    },
  };
}

function renderOneTap(
  overrides?: Partial<{
    enabled: boolean;
    clientId: string;
    ref: RefObject<GoogleOneTapHandle | null>;
    onCredential: (idToken: string) => void;
    onStart: () => void;
  }>,
) {
  const onSuccess = vi.fn();
  const onError = vi.fn();
  const onStart = vi.fn();
  render(
    <ThemeProvider>
      <GoogleOneTap
        ref={overrides?.ref}
        clientId={overrides?.clientId ?? "client-id.apps.googleusercontent.com"}
        enabled={overrides?.enabled ?? true}
        onSuccess={onSuccess}
        onError={onError}
        onCredential={overrides?.onCredential}
        onStart={overrides?.onStart ?? onStart}
      />
    </ThemeProvider>,
  );
  return { onSuccess, onError, onStart };
}

beforeEach(() => {
  loginWithOneTapMock.mockReset();
  initCalls.length = 0;
  promptCalls.length = 0;
  promptListeners.length = 0;
  delete (window as unknown as { google?: unknown }).google;
});

afterEach(() => {
  document.querySelectorAll('script[src*="accounts.google.com"]').forEach((node) => {
    node.remove();
  });
});

describe("GoogleOneTap", () => {
  it("prompts through GSI when enabled and the SDK is available", async () => {
    installGsi();
    const { onError } = renderOneTap();

    await waitFor(() => expect(promptCalls).toHaveLength(1));

    expect(initCalls).toHaveLength(1);
    expect(initCalls[0].client_id).toBe("client-id.apps.googleusercontent.com");
    expect(onError).not.toHaveBeenCalled();
  });

  it("never prompts while the session is still being resolved", async () => {
    installGsi();
    renderOneTap({ enabled: false });

    await new Promise((resolve) => setTimeout(resolve, 50));

    expect(initCalls).toHaveLength(0);
    expect(promptCalls).toHaveLength(0);
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

  it("re-opens the prompt through the ref", async () => {
    installGsi();
    const ref = createRef<GoogleOneTapHandle>();
    renderOneTap({ ref });

    await waitFor(() => expect(initCalls).toHaveLength(1));
    await waitFor(() => expect(promptCalls).toHaveLength(1));
    ref.current?.prompt();

    expect(promptCalls).toHaveLength(2);
  });

  it("reports unavailability when the SDK is not ready", () => {
    const ref = createRef<GoogleOneTapHandle>();
    renderOneTap({ enabled: false, ref });
    const onUnavailable = vi.fn();

    ref.current?.prompt(onUnavailable);

    expect(onUnavailable).toHaveBeenCalledOnce();
  });

  it("reports unavailability when Google skips the prompt", async () => {
    installGsi();
    const ref = createRef<GoogleOneTapHandle>();
    renderOneTap({ ref });

    await waitFor(() => expect(initCalls).toHaveLength(1));
    const onUnavailable = vi.fn();
    ref.current?.prompt(onUnavailable);
    promptListeners.at(-1)?.({ isNotDisplayed: () => false, isSkippedMoment: () => true });

    expect(onUnavailable).toHaveBeenCalledOnce();
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
