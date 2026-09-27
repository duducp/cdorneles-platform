import "@testing-library/jest-dom/vitest";

import { cleanup } from "@testing-library/react";
import { afterEach } from "vitest";

// Turnstile: jsdom não carrega api.js. Um widget-mock entrega "test-token"
// no render e a cada reset, para as páginas que esperam um token seguir.
// Testes de componente que precisam de controle manual sobrescrevem isto.
process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY ||= "1x00000000000000000000AA";
if (!window.turnstile) {
  let fire: (() => void) | null = null;
  window.turnstile = {
    render: (_container, options) => {
      const callback = options.callback as (token: string) => void;
      fire = () => {
        window.setTimeout(() => callback("test-token"), 0);
      };
      fire();
      return "test-widget";
    },
    reset: () => {
      fire?.();
    },
    remove: () => {
      fire = null;
    },
  };
}

afterEach(() => {
  cleanup();
});

if (!window.matchMedia) {
  window.matchMedia = (query: string): MediaQueryList =>
    ({
      matches: false,
      media: query,
      onchange: null,
      addListener: () => undefined,
      removeListener: () => undefined,
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
      dispatchEvent: () => false,
    }) as MediaQueryList;
}
