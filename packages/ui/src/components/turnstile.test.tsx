import "@testing-library/jest-dom/vitest";

import { ThemeProvider } from "@cdorneles/theme";
import { createRef } from "react";
import { render, act } from "@testing-library/react";
import { afterEach, describe, expect, it, vi, type Mock } from "vitest";

import { Turnstile, useTurnstile, type TurnstileHandle } from "./turnstile";

type WidgetOptions = Record<string, unknown>;

interface Harness {
  options: WidgetOptions[];
  reset: Mock<(id: string) => void>;
  remove: Mock<(id: string) => void>;
}

/** Manual widget: nothing fires until the test calls the stored callback. */
function installWidget(): Harness {
  const harness: Harness = { options: [], reset: vi.fn(), remove: vi.fn() };
  const previous = window.turnstile;
  window.turnstile = {
    render: (_container, options) => {
      harness.options.push(options);
      return `widget-${harness.options.length}`;
    },
    reset: (id: string) => harness.reset(id),
    remove: (id: string) => harness.remove(id),
  };
  afterEach(() => {
    window.turnstile = previous;
  });
  return harness;
}

async function renderTurnstile(props: { siteKey?: string } = {}) {
  const ref = createRef<TurnstileHandle>();
  const view = render(
    <ThemeProvider>
      <Turnstile ref={ref} {...props} />
    </ThemeProvider>,
  );
  // The widget renders after the (already resolved) script promise settles.
  await act(async () => {});
  return { ref, view };
}

describe("Turnstile", () => {
  it("fails closed without a site key", async () => {
    const { ref } = await renderTurnstile({ siteKey: "" });
    await expect(ref.current!.nextToken()).rejects.toMatchObject({
      name: "TurnstileError",
      code: "turnstile_not_configured",
      message: "Verificação de segurança não configurada neste ambiente.",
    });
  });

  it("returns the minted token and pre-mints the next one", async () => {
    const harness = installWidget();
    const { ref } = await renderTurnstile({ siteKey: "site-key" });
    expect(harness.options).toHaveLength(1);
    expect(harness.options[0]).toMatchObject({
      sitekey: "site-key",
      // Interaction-only: the widget stays invisible unless Cloudflare's risk
      // analysis demands user interaction.
      appearance: "interaction-only",
    });

    (harness.options[0].callback as (t: string) => void)("tok-1");
    await expect(ref.current!.nextToken()).resolves.toBe("tok-1");
    expect(harness.reset).toHaveBeenCalledWith("widget-1");

    const pending = ref.current!.nextToken();
    (harness.options[0].callback as (t: string) => void)("tok-2");
    await expect(pending).resolves.toBe("tok-2");
  });

  it("times out when no token arrives", async () => {
    installWidget();
    const { ref } = await renderTurnstile({ siteKey: "site-key" });
    await expect(ref.current!.nextToken(10)).rejects.toMatchObject({ code: "turnstile_timeout" });
  });

  it("rejects waiters when the widget errors", async () => {
    const harness = installWidget();
    const { ref } = await renderTurnstile({ siteKey: "site-key" });
    const pending = ref.current!.nextToken();
    (harness.options[0]["error-callback"] as () => void)();
    await expect(pending).rejects.toMatchObject({ code: "turnstile_unavailable" });
  });

  it("clears and re-mints on expiry", async () => {
    const harness = installWidget();
    const { ref } = await renderTurnstile({ siteKey: "site-key" });
    (harness.options[0].callback as (t: string) => void)("tok-1");
    await expect(ref.current!.nextToken()).resolves.toBe("tok-1");
    (harness.options[0]["expired-callback"] as () => void)();
    expect(harness.reset).toHaveBeenCalledWith("widget-1");
    await expect(ref.current!.nextToken(10)).rejects.toMatchObject({ code: "turnstile_timeout" });
  });

  it("removes the widget on unmount", async () => {
    const harness = installWidget();
    const { view } = await renderTurnstile({ siteKey: "site-key" });
    view.unmount();
    expect(harness.remove).toHaveBeenCalledWith("widget-1");
  });

  it("useTurnstile rejects when no widget is mounted", async () => {
    let nextToken: (() => Promise<string>) | undefined;
    function Screen() {
      const turnstile = useTurnstile();
      nextToken = turnstile.nextToken;
      return null;
    }
    render(
      <ThemeProvider>
        <Screen />
      </ThemeProvider>,
    );
    await expect(nextToken!()).rejects.toMatchObject({ code: "turnstile_unavailable" });
  });
});
