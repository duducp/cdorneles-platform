import "@testing-library/jest-dom/vitest";

import {
  Checkbox,
  JsonInput,
  PasswordInput,
  PinInput,
  Radio,
  Select,
  Switch,
  Textarea,
  TextInput,
} from "@mantine/core";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { ThemeProvider } from "./theme-provider";

class ResizeObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}
if (!globalThis.ResizeObserver) {
  globalThis.ResizeObserver = ResizeObserverStub as unknown as typeof ResizeObserver;
}

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");

function readRepoFile(relativePath: string): string {
  try {
    return readFileSync(path.join(repoRoot, relativePath), "utf8");
  } catch {
    return "";
  }
}

/**
 * iOS (Safari and Chrome iOS, both WebKit) zooms the page when a focused
 * editable control renders below 16 CSS px. Mantine sizes inputs with
 * `--input-fz` (default `size="sm"` -> 13px), which triggered the zoom on
 * every field. These tests pin the global, theme-level fix in place.
 */
describe("iOS focus auto-zoom guard", () => {
  it("exports the theme global stylesheet and marks it as a side effect", () => {
    const pkg = JSON.parse(readRepoFile("packages/theme/package.json")) as {
      exports: Record<string, string>;
      sideEffects: string[];
    };

    expect(pkg.exports["./global.css"]).toBe("./src/global.css");
    expect(pkg.sideEffects).toContain("**/*.css");
  });

  it("loads the stylesheet once in every app layout, after the Mantine core styles", () => {
    for (const app of ["admin", "client", "design-system"]) {
      const layout = readRepoFile(`apps/${app}/src/app/layout.tsx`);
      expect(layout, `${app} layout must import the theme global stylesheet`).toContain(
        'import "@cdorneles/theme/global.css";',
      );
      // A few rules (Switch font-size, JsonInput monospace) tie with Mantine's
      // own specificity and win only because this stylesheet loads after core.
      const coreStylesIndex = layout.indexOf('import "@mantine/core/styles.css";');
      const themeIndex = layout.indexOf('import "@cdorneles/theme/global.css";');
      expect(coreStylesIndex, `${app} layout must import the Mantine core styles`).toBeGreaterThan(
        -1,
      );
      expect(
        themeIndex,
        `${app} must load theme globals after the Mantine core styles`,
      ).toBeGreaterThan(coreStylesIndex);
    }
  });

  it("raises Mantine's input font variable to the 16px iOS threshold on touch devices", () => {
    const css = readRepoFile("packages/theme/src/global.css");

    expect(css).toMatch(/@media\s*\(any-pointer:\s*coarse\)/);
    expect(css).toMatch(/\.mantine-Input-input\s*\{[^}]*--input-fz:\s*16px/u);
    // JsonInput sets [data-monospace], which recomputes --_input-fz down by 2px
    // and wins in Mantine's font-size chain; it must be pinned back to 16px.
    expect(css).toMatch(/\.mantine-Input-input\[data-monospace\]\s*\{[^}]*--_input-fz:\s*16px/u);
    // Non-text controls inherit or get a smaller font-size from Mantine and are
    // zoomed the same way by WebKit; all three keep fixed dimensions.
    expect(css).toMatch(
      /\.mantine-Checkbox-input,\s*\.mantine-Radio-radio,\s*\.mantine-Switch-input\s*\{[^}]*font-size:\s*16px/u,
    );
  });

  it("never disables page zoom to work around the iOS behavior", () => {
    const css = readRepoFile("packages/theme/src/global.css");
    expect(css).not.toBe("");
    expect(css).not.toMatch(/maximum-scale|user-scalable/);

    for (const app of ["admin", "client", "design-system"]) {
      const layout = readRepoFile(`apps/${app}/src/app/layout.tsx`);
      expect(layout).not.toBe("");
      expect(layout).not.toMatch(/maximum-scale|user-scalable/);
    }
  });
});

/**
 * The stylesheet targets Mantine's static classes. Guard the contract with the
 * rendered components so a Mantine upgrade that changes class names fails here
 * instead of silently reintroducing the zoom.
 */
describe("stylesheet selector contract", () => {
  it("puts the input class on every editable element the guard relies on", () => {
    const { container } = render(
      <ThemeProvider>
        <TextInput label="E-mail" />
        <PasswordInput label="Senha" />
        <Textarea label="Nota" />
        <Select label="Cargo" data={[]} />
        <PinInput length={4} aria-label="Código" />
        <Checkbox label="Ativo" />
        <Radio name="role" label="Administrador" />
        <Switch label="Notificações" />
        <JsonInput label="Observações" defaultValue="{}" />
      </ThemeProvider>,
    );

    const textInput = container.querySelector<HTMLInputElement>("input.mantine-TextInput-input");
    expect(textInput).not.toBeNull();

    const passwordInput = container.querySelector<HTMLInputElement>(
      "input.mantine-PasswordInput-innerInput",
    );
    expect(passwordInput).not.toBeNull();
    expect(passwordInput?.parentElement?.matches(".mantine-Input-input")).toBe(true);

    expect(container.querySelector("textarea.mantine-Input-input")).not.toBeNull();
    expect(container.querySelector("input.mantine-Select-input")).not.toBeNull();
    expect(container.querySelectorAll("input.mantine-PinInput-input")).toHaveLength(4);
    expect(container.querySelector("input.mantine-Checkbox-input")).not.toBeNull();
    expect(container.querySelector("input.mantine-Radio-radio")).not.toBeNull();
    expect(container.querySelector("input.mantine-Switch-input")).not.toBeNull();
    expect(container.querySelector("textarea.mantine-Input-input[data-monospace]")).not.toBeNull();

    // Load-bearing premise: --input-fz reaches the real element only through
    // inheritance, so a stylesheet declaration on the element wins without
    // !important. A Mantine upgrade moving vars onto the input must fail here.
    for (const element of container.querySelectorAll<HTMLElement>(".mantine-Input-input")) {
      expect(element.style.length, `${element.className} must not carry inline styles`).toBe(0);
    }
  });
});
