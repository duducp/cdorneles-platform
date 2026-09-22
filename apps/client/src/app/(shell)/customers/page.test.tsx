import "@testing-library/jest-dom/vitest";

import { ThemeProvider } from "@cdorneles/theme";
import { render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";

vi.mock("@cdorneles/auth", () => ({
  useAuth: () => ({ user: { id: "user-1", name: "Test" } }),
}));

vi.mock("@cdorneles/tenant", () => ({
  useTenant: () => ({
    currentOrganization: { id: "org-1", name: "Test Org" },
    ready: true,
  }),
}));

vi.mock("@cdorneles/ui/permissions", () => ({
  PermissionGate: ({ children }: { children: ReactNode }) => <>{children}</>,
}));

import { CustomersPage } from "./page";

describe("Client CustomersPage", () => {
  it("renders the customers heading scoped to the organization", () => {
    render(
      <ThemeProvider>
        <CustomersPage />
      </ThemeProvider>,
    );

    // Anchored: the EmptyState title ("No customers yet") is also a heading.
    expect(screen.getByRole("heading", { name: /^customers$/i })).toBeInTheDocument();
    expect(screen.getByText(/Test Org/)).toBeInTheDocument();
  });
});
