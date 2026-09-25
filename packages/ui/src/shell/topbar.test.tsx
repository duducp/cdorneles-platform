import "@testing-library/jest-dom/vitest";

import { ThemeProvider } from "@cdorneles/theme";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { Topbar } from "./topbar";

function renderTopbar(props: Partial<Parameters<typeof Topbar>[0]> = {}) {
  return render(
    <ThemeProvider>
      <Topbar
        userName="Ana Silva"
        sidebarOpened={false}
        onToggleSidebar={vi.fn()}
        onLogout={vi.fn()}
        {...props}
      />
    </ThemeProvider>,
  );
}

describe("Topbar", () => {
  it("renders the logo and left section when provided", () => {
    renderTopbar({
      logo: <img src="/brand/favicon.png" alt="Logo" />,
      leftSection: <div data-testid="org-switcher" />,
    });

    expect(screen.getByAltText("Logo")).toBeInTheDocument();
    expect(screen.getByTestId("org-switcher")).toBeInTheDocument();
  });

  it("renders without logo and left section", () => {
    renderTopbar();

    expect(screen.queryByAltText("Logo")).not.toBeInTheDocument();
    expect(screen.queryByTestId("org-switcher")).not.toBeInTheDocument();
  });

  it("renders the filter input", () => {
    renderTopbar();

    expect(screen.getByLabelText("Filtrar")).toBeInTheDocument();
  });

  it("emits filter changes when a handler is given", async () => {
    const onFilterChange = vi.fn();
    renderTopbar({ onFilterChange });

    await userEvent.type(screen.getByLabelText("Filtrar"), "abc");

    expect(onFilterChange).toHaveBeenCalledTimes(3);
  });

  it("keeps the controlled filter value without a handler (visual-only mode)", async () => {
    renderTopbar({ filterValue: "x" });

    await userEvent.type(screen.getByLabelText("Filtrar"), "y");

    // Controlled without onChange: the value stays as provided.
    expect(screen.getByLabelText("Filtrar")).toHaveValue("x");
  });

  it("opens the user menu", async () => {
    renderTopbar();

    await userEvent.click(screen.getByLabelText(/conta: ana silva/i));

    expect(await screen.findByRole("menuitem", { name: /sair/i })).toBeInTheDocument();
  });

  it("renders the breadcrumb trail when provided", () => {
    renderTopbar({
      breadcrumbTrail: [{ label: "Customers", href: "/customers" }],
    });

    expect(screen.getByRole("navigation", { name: "Breadcrumb" })).toBeInTheDocument();
    expect(screen.getByText("Customers")).toHaveAttribute("aria-current", "page");
  });

  it("renders no breadcrumb navigation when the trail is empty", () => {
    renderTopbar();

    expect(screen.queryByRole("navigation", { name: "Breadcrumb" })).not.toBeInTheDocument();
  });
});
