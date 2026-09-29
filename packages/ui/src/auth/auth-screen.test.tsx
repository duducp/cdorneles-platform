import "@testing-library/jest-dom/vitest";

import { ThemeProvider } from "@cdorneles/theme";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { AuthScreen, type AuthScreenProps } from "./auth-screen";

function styleSheetTexts(): string[] {
  return Array.from(document.styleSheets).flatMap((sheet) =>
    Array.from(sheet.cssRules ?? []).map((rule) => rule.cssText ?? ""),
  );
}

function renderAuthScreen(props: Partial<AuthScreenProps> = {}) {
  return render(
    <ThemeProvider>
      <AuthScreen form={<span>form-slot</span>} {...props} />
    </ThemeProvider>,
  );
}

describe("AuthScreen", () => {
  it("renders the header theme toggle, a single main landmark and the brand footer", () => {
    const { container } = renderAuthScreen();

    expect(screen.getByRole("button", { name: "Alternar tema claro/escuro" })).toBeInTheDocument();
    expect(container.querySelectorAll("main")).toHaveLength(1);
    const footer = screen.getByRole("contentinfo");
    const logos = screen.getAllByAltText("Carlos Dorneles");
    expect(logos.length).toBeGreaterThan(0);
    for (const logo of logos) {
      expect(footer).toContainElement(logo);
    }
  });

  it("stretches and pads main through Mantine style props", () => {
    const { container } = renderAuthScreen();

    const main = container.querySelector("main");
    expect(main?.getAttribute("style") ?? "").toContain("flex");
    expect(main?.getAttribute("style") ?? "").toContain("padding");
  });

  it("aligns main responsively and pins the footer below md", () => {
    const { container } = renderAuthScreen();

    const main = container.querySelector("main");
    expect(main).not.toBeNull();
    const mainClasses = (main?.className ?? "").split(/\s+/).filter(Boolean);
    const mainRules = styleSheetTexts()
      .filter((text) => mainClasses.some((cls) => text.includes(cls)))
      .join("\n");
    expect(mainRules).toContain("align-items: stretch");
    expect(mainRules).toContain("@media (min-width: 48em)");
    expect(mainRules).toContain("align-items: center");

    const stack = main?.querySelector(":scope > div");
    expect(stack).not.toBeNull();
    expect((stack as HTMLElement).style.getPropertyValue("--stack-justify")).toBe("space-between");
  });

  it("renders the form slot inside the card, and the visual only when provided", () => {
    const { rerender } = renderAuthScreen();

    expect(screen.getByText("form-slot")).toBeInTheDocument();
    expect(screen.queryByText("visual-slot")).not.toBeInTheDocument();

    rerender(
      <ThemeProvider>
        <AuthScreen form={<span>form-slot</span>} visual={<span>visual-slot</span>} />
      </ThemeProvider>,
    );
    expect(screen.getByText("visual-slot")).toBeInTheDocument();
  });

  it("blocks the card with the overlay while loading", () => {
    renderAuthScreen({ loading: true });

    expect(screen.getByText("Entrando…")).toBeInTheDocument();
  });

  it("announces through a polite live region when announcement is provided", () => {
    const { container } = renderAuthScreen({ announcement: "Entrando..." });

    const region = container.querySelector('[aria-live="polite"]');
    expect(region).toHaveTextContent("Entrando...");
  });

  it("keeps the live region mounted for an empty announcement", () => {
    const { container } = renderAuthScreen({ announcement: "" });

    expect(container.querySelector('[aria-live="polite"]')).not.toBeNull();
  });

  it("omits the live region when no announcement is given", () => {
    const { container } = renderAuthScreen();

    expect(container.querySelector('[aria-live="polite"]')).toBeNull();
  });

  it("renders the form inside a suspense boundary when asked", () => {
    renderAuthScreen({ suspense: true });

    expect(screen.getByText("form-slot")).toBeInTheDocument();
  });
});
