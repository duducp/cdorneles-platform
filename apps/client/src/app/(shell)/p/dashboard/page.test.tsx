import "@testing-library/jest-dom/vitest";

import { ThemeProvider } from "@cdorneles/theme";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("@cdorneles/tenant", () => ({
  useTenant: () => ({
    currentOrganization: { id: "org-1", name: "Test Org" },
    ready: true,
  }),
}));

import { DashboardPage } from "./page";

describe("Client DashboardPage", () => {
  it("renders the organization name", () => {
    render(
      <ThemeProvider>
        <DashboardPage />
      </ThemeProvider>,
    );

    expect(screen.getByRole("heading", { name: /dashboard/i })).toBeInTheDocument();
    // Substring: the name sits inside the overview sentence.
    expect(screen.getByText(/Test Org/)).toBeInTheDocument();
  });
});
