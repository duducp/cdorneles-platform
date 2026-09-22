import "@testing-library/jest-dom/vitest";

import { ThemeProvider } from "@cdorneles/theme";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { Sidebar } from "./sidebar";

class ResizeObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}

if (!globalThis.ResizeObserver) {
  globalThis.ResizeObserver = ResizeObserverStub as unknown as typeof ResizeObserver;
}

const renderSidebar = (collapsed: boolean) =>
  render(
    <ThemeProvider>
      <Sidebar items={[]} activeHref="/" collapsed={collapsed} />
    </ThemeProvider>,
  );

describe("Sidebar", () => {
  it("shows the symbol mark when collapsed", () => {
    renderSidebar(true);

    expect(screen.getAllByAltText("Logo")).toHaveLength(1);
    expect(screen.getByAltText("Logo")).toHaveAttribute("src", "/brand/favicon.png");
  });

  it("shows the horizontal lockup when expanded", () => {
    renderSidebar(false);

    expect(screen.getAllByAltText("Logo")).toHaveLength(2);
    expect(screen.getAllByAltText("Logo")[0]).toHaveAttribute("src", "/brand/logo-light-h.webp");
  });
});
