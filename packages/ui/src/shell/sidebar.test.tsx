import "@testing-library/jest-dom/vitest";

import { ThemeProvider } from "@cdorneles/theme";
import { render, screen, within } from "@testing-library/react";
import { Home, Settings, Users } from "lucide-react";
import { describe, expect, it } from "vitest";

import { Sidebar, type SidebarNavItem } from "./sidebar";

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

describe("Sidebar sections", () => {
  const SECTIONS: SidebarNavItem[] = [
    { label: "Dashboard", href: "/dashboard", icon: Home },
    { label: "Customers", href: "/customers", icon: Users, section: "General" },
    { label: "Settings", href: "/settings", icon: Settings, section: "Configuration" },
  ];

  function renderSidebarWith(items: SidebarNavItem[], collapsed = false) {
    return render(
      <ThemeProvider>
        <Sidebar items={items} activeHref="/customers" collapsed={collapsed} />
      </ThemeProvider>,
    );
  }

  it("renders unsectioned items first, in an untitled group", () => {
    renderSidebarWith(SECTIONS);

    const links = within(screen.getByRole("navigation")).getAllByRole("link");
    expect(links[0]).toHaveAttribute("href", "/dashboard");
    expect(links[1]).toHaveAttribute("href", "/customers");
  });

  it("renders a title per section, grouped by first appearance", () => {
    renderSidebarWith(SECTIONS);

    expect(screen.getByText("General")).toBeInTheDocument();
    expect(screen.getByText("Configuration")).toBeInTheDocument();
    // Section titles are plain text, not links or headings.
    expect(screen.getByText("General").closest("a, h1, h2, h3, h4, h5, h6")).toBeNull();
  });

  it("omits section titles when collapsed", () => {
    renderSidebarWith(SECTIONS, true);

    expect(screen.queryByText("General")).not.toBeInTheDocument();
    expect(screen.queryByText("Configuration")).not.toBeInTheDocument();
    // All items still render as links with their tooltips.
    expect(within(screen.getByRole("navigation")).getAllByRole("link")).toHaveLength(3);
  });
});
