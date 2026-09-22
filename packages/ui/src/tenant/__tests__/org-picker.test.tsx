import "@testing-library/jest-dom/vitest";

import { ThemeProvider } from "@cdorneles/theme";
import { render, screen } from "@testing-library/react";
import type { ReactElement } from "react";
import { describe, expect, it, vi } from "vitest";

import type { Branding } from "@cdorneles/types";

import { OrgPicker } from "../org-picker";

function renderWithTheme(ui: ReactElement) {
  return render(<ThemeProvider>{ui}</ThemeProvider>);
}

describe("OrgPicker", () => {
  it("renders organization names", () => {
    renderWithTheme(
      <OrgPicker
        organizations={[
          { id: "org-1", name: "Acme Corp" },
          { id: "org-2", name: "Globex" },
        ]}
        onSelect={vi.fn()}
      />,
    );

    expect(screen.getByText("Acme Corp")).toBeInTheDocument();
    expect(screen.getByText("Globex")).toBeInTheDocument();
  });

  it("shows empty state when no organizations", () => {
    renderWithTheme(<OrgPicker organizations={[]} onSelect={vi.fn()} />);

    expect(screen.getByText("No organizations")).toBeInTheDocument();
  });

  it("renders org logo when branding has logoLight", () => {
    renderWithTheme(
      <OrgPicker
        organizations={[{ id: "org-1", name: "Test" }]}
        onSelect={vi.fn()}
        branding={{ logoLight: "https://example.com/logo.png" } as Branding}
      />,
    );

    expect(screen.getByRole("img", { name: "Test" })).toHaveAttribute(
      "src",
      "https://example.com/logo.png",
    );
  });

  it("falls back to Building2 icon when no logoLight", () => {
    renderWithTheme(
      <OrgPicker organizations={[{ id: "org-1", name: "Test" }]} onSelect={vi.fn()} />,
    );

    expect(screen.queryByRole("img", { name: "Test" })).not.toBeInTheDocument();
    expect(screen.getByText("Test")).toBeInTheDocument();
  });

  it("applies primaryColor to active button border", () => {
    renderWithTheme(
      <OrgPicker
        organizations={[{ id: "org-1", name: "Test" }]}
        currentOrganizationId="org-1"
        onSelect={vi.fn()}
        branding={{ primaryColor: "#ff0000" } as Branding}
      />,
    );

    const button = screen.getByRole("button", { name: /Test/ });
    expect(button).toHaveStyle({ borderColor: "#ff0000" });
  });

  it("applies primaryColor background tint to active button", () => {
    renderWithTheme(
      <OrgPicker
        organizations={[{ id: "org-1", name: "Test" }]}
        currentOrganizationId="org-1"
        onSelect={vi.fn()}
        branding={{ primaryColor: "#ff0000" } as Branding}
      />,
    );

    const button = screen.getByRole("button", { name: /Test/ });
    expect(button.style.backgroundColor).toMatch(/rgba\(255, 0, 0, 0\.06/);
  });

  it("does not apply brand colors when branding is absent", () => {
    renderWithTheme(
      <OrgPicker
        organizations={[{ id: "org-1", name: "Test" }]}
        currentOrganizationId="org-1"
        onSelect={vi.fn()}
      />,
    );

    const button = screen.getByRole("button", { name: /Test/ });
    expect(button.style.borderColor).toBe("var(--mantine-color-brand-6)");
    expect(button.style.backgroundColor).toBe("");
  });
});
