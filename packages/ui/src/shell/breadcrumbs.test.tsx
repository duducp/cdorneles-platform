import "@testing-library/jest-dom/vitest";

import { ThemeProvider } from "@cdorneles/theme";
import { render, screen } from "@testing-library/react";
import { Home } from "lucide-react";
import { describe, expect, it } from "vitest";

import { BreadcrumbTrail, deriveTrail, type Crumb } from "./breadcrumbs";
import type { SidebarNavItem } from "./sidebar";

describe("deriveTrail", () => {
  const items: SidebarNavItem[] = [
    { label: "Dashboard", href: "/dashboard", icon: Home },
    { label: "Customers", href: "/customers", icon: Home },
  ];

  it("uses the nav item label for the first segment", () => {
    expect(deriveTrail("/dashboard", items)).toEqual([
      { label: "Dashboard", href: "/dashboard" },
    ]);
  });

  it("capitalizes deeper segments and keeps cumulative hrefs", () => {
    expect(deriveTrail("/customers/acme/orders", items)).toEqual([
      { label: "Customers", href: "/customers" },
      { label: "Acme", href: "/customers/acme" },
      { label: "Orders", href: "/customers/acme/orders" },
    ]);
  });

  it("falls back to a capitalized segment when no item matches", () => {
    expect(deriveTrail("/unknown/path", [])).toEqual([
      { label: "Unknown", href: "/unknown" },
      { label: "Path", href: "/unknown/path" },
    ]);
  });

  it("returns an empty trail for the root", () => {
    expect(deriveTrail("/", [])).toEqual([]);
  });
});

describe("BreadcrumbTrail", () => {
  const trail: Crumb[] = [
    { label: "Customers", href: "/customers" },
    { label: "Acme", href: "/customers/acme" },
  ];

  it("marks the last crumb as the current page; earlier crumbs are links", () => {
    render(
      <ThemeProvider>
        <BreadcrumbTrail trail={trail} linkComponent="a" />
      </ThemeProvider>,
    );

    const links = screen.getAllByRole("link");
    expect(links).toHaveLength(1);
    expect(links[0]).toHaveAttribute("href", "/customers");
    expect(screen.getByText("Customers")).toBeInTheDocument();
    expect(screen.getByText("Acme")).toHaveAttribute("aria-current", "page");
  });

  it("renders no breadcrumb navigation for an empty trail", () => {
    render(
      <ThemeProvider>
        <BreadcrumbTrail trail={[]} linkComponent="a" />
      </ThemeProvider>,
    );

    // container.firstChild is Mantine's injected <style>, not the component.
    expect(screen.queryByRole("navigation", { name: "Breadcrumb" })).not.toBeInTheDocument();
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
  });
});
