import "@testing-library/jest-dom/vitest";

import { ApiError } from "@cdorneles/api-client";
import { ThemeProvider } from "@cdorneles/theme";
import { render, waitFor } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";

import { GoogleOneTap, describeOneTapError } from "./google-one-tap";

const { loginWithOneTapMock } = vi.hoisted(() => ({ loginWithOneTapMock: vi.fn() }));

vi.mock("@cdorneles/auth", () => ({
  useAuth: () => ({ loginWithOneTap: loginWithOneTapMock }),
}));

type InitConfig = {
  client_id: string;
  callback: (response: { credential?: string }) => void;
};

const initCalls: InitConfig[] = [];
const promptCalls: number[] = [];

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
        prompt: () => {
          promptCalls.push(promptCalls.length);
        },
      },
    },
  };
}

function renderOneTap(overrides?: Partial<{ enabled: boolean; clientId: string }>) {
  const onSuccess = vi.fn();
  const onError = vi.fn();
  render(
    <ThemeProvider>
      <GoogleOneTap
        clientId={overrides?.clientId ?? "client-id.apps.googleusercontent.com"}
        enabled={overrides?.enabled ?? true}
        onSuccess={onSuccess}
        onError={onError}
      />
    </ThemeProvider>,
  );
  return { onSuccess, onError };
}

beforeEach(() => {
  loginWithOneTapMock.mockReset();
  initCalls.length = 0;
  promptCalls.length = 0;
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

  it("surfaces a mapped message when the exchange fails", async () => {
    installGsi();
    loginWithOneTapMock.mockRejectedValue(
      new ApiError("no platform user", { code: "unknown_email", status: 403 }),
    );
    const { onError } = renderOneTap();

    await waitFor(() => expect(initCalls).toHaveLength(1));
    initCalls[0].callback({ credential: "the-jwt" });

    await waitFor(() => expect(onError).toHaveBeenCalledOnce());
    expect(onError.mock.calls[0][0]).toContain("Não há conta na plataforma");
  });

  it("reports an error when the GSI script fails to load", async () => {
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
    expect(onError.mock.calls[0][0]).toContain("Não foi possível entrar");
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
});
