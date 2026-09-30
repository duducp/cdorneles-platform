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

import { SettingsPage } from "./page";

describe("Client SettingsPage", () => {
  it("renders the settings heading scoped to the organization", () => {
    render(
      <ThemeProvider>
        <SettingsPage />
      </ThemeProvider>,
    );

    expect(screen.getByRole("heading", { name: /settings/i })).toBeInTheDocument();
    // Substring: the name sits inside the settings sentence.
    expect(screen.getByText(/Test Org/)).toBeInTheDocument();
  });
});
