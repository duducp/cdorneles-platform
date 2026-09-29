import "@testing-library/jest-dom/vitest";

import { ThemeProvider } from "@cdorneles/theme";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { AuthCard } from "./auth-card";

function styleSheetTexts(): string[] {
  return Array.from(document.styleSheets).flatMap((sheet) =>
    Array.from(sheet.cssRules ?? []).map((rule) => rule.cssText ?? ""),
  );
}

describe("AuthCard", () => {
  it("renders the form and the visual panel", () => {
    render(
      <ThemeProvider>
        <AuthCard form={<span>form-slot</span>} visual={<span>visual-slot</span>} />
      </ThemeProvider>,
    );

    expect(screen.getByText("form-slot")).toBeInTheDocument();
    expect(screen.getByText("visual-slot")).toBeInTheDocument();
  });

  it("omits the visual panel when not provided", () => {
    render(
      <ThemeProvider>
        <AuthCard form={<span>form-slot</span>} />
      </ThemeProvider>,
    );

    expect(screen.getByText("form-slot")).toBeInTheDocument();
    expect(screen.queryByText("visual-slot")).not.toBeInTheDocument();
  });

  it("shows a blocking overlay while loading and makes the content inert", () => {
    render(
      <ThemeProvider>
        <AuthCard
          form={
            <form>
              <button type="button">Entrar</button>
            </form>
          }
          loading
        />
      </ThemeProvider>,
    );

    expect(screen.getByText("Entrando…")).toBeInTheDocument();
    expect(screen.getByRole("status")).toBeInTheDocument();

    const button = screen.getByRole("button", { name: "Entrar" });
    expect(button.closest("[inert]")).not.toBeNull();
  });

  it("has no overlay when not loading", () => {
    render(
      <ThemeProvider>
        <AuthCard form={<span>form-slot</span>} />
      </ThemeProvider>,
    );

    expect(screen.queryByText("Entrando…")).not.toBeInTheDocument();
  });

  it("owns the form panel padding responsively", () => {
    render(
      <ThemeProvider>
        <AuthCard form={<span>form-slot</span>} />
      </ThemeProvider>,
    );

    const panel = screen.getByText("form-slot").parentElement;
    expect(panel).not.toBeNull();
    // Responsive style props emit classes — never inline padding.
    expect(panel?.getAttribute("style") ?? "").not.toContain("padding");

    const classNames = (panel?.className ?? "").split(/\s+/).filter(Boolean);
    const rules = styleSheetTexts().filter((text) => classNames.some((cls) => text.includes(cls)));
    const joined = rules.join("\n");
    expect(joined).toContain("padding: var(--mantine-spacing-md)");
    expect(joined).toContain("@media (min-width: 48em)");
    expect(joined).toContain("padding: var(--mantine-spacing-xl)");
  });

  it("keeps the wrapper minHeight at auto below md", () => {
    render(
      <ThemeProvider>
        <AuthCard form={<span>form-slot</span>} />
      </ThemeProvider>,
    );

    const wrapper = screen.getByText("form-slot").parentElement?.parentElement;
    expect(wrapper).not.toBeNull();
    const classNames = (wrapper?.className ?? "").split(/\s+/).filter(Boolean);
    const joined = styleSheetTexts()
      .filter((text) => classNames.some((cls) => text.includes(cls)))
      .join("\n");
    expect(joined).toContain("min-height: auto");
    expect(joined).toContain("@media (min-width: 48em)");
    expect(joined).toContain("min-height: calc(35rem");
  });

  it("marks the root with data-auth-card for the full-bleed media query", () => {
    render(
      <ThemeProvider>
        <AuthCard form={<span>form-slot</span>} />
      </ThemeProvider>,
    );

    expect(screen.getByText("form-slot").closest("[data-auth-card]")).not.toBeNull();
  });
});
