import "@testing-library/jest-dom/vitest";

import type { GrantedAccess } from "@cdorneles/permissions";
import { permissionKey } from "@cdorneles/permissions";
import { AccessProvider } from "@cdorneles/ui/permissions";
import { MantineProvider } from "@mantine/core";
import { render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { useAuthMock, useTenantMock, pushMock } = vi.hoisted(() => ({
  useAuthMock: vi.fn(),
  useTenantMock: vi.fn(),
  pushMock: vi.fn(),
}));

vi.mock("@cdorneles/auth", () => ({ useAuth: useAuthMock }));
vi.mock("@cdorneles/tenant", () => ({ useTenant: useTenantMock }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: pushMock }) }));
vi.mock("@cdorneles/ui", () => ({
  Button: ({ children, onClick }: { children?: ReactNode; onClick?: () => void }) => (
    <button type="button" onClick={onClick}>
      {children}
    </button>
  ),
  LoadingScreen: () => <div data-testid="loading-screen" />,
  Logo: () => <div data-testid="logo" />,
  ThemeToggle: () => <div data-testid="theme-toggle" />,
}));
vi.mock("@cdorneles/ui/tenant", () => ({
  OrgPicker: () => <div data-testid="org-picker" />,
  CreateOrganizationForm: () => <div data-testid="create-org-form" />,
}));

const { SelectOrgPage } = await import("./select-org-page");

const NO_ORGS_MESSAGE = "Nenhuma organização vinculada. Fale com um administrador.";
const CREATE_BUTTON = /create organization/i;

const GRANTED: GrantedAccess = {
  permissions: [permissionKey("organizations.create")],
  features: [],
};
const DENIED: GrantedAccess = { permissions: [], features: [] };

function tenantState(overrides: Record<string, unknown> = {}) {
  return {
    organizations: [],
    currentOrganization: null,
    ready: true,
    switchOrganization: vi.fn(),
    createOrganization: vi.fn(),
    ...overrides,
  };
}

function renderPage(granted: GrantedAccess) {
  return render(
    <MantineProvider>
      <AccessProvider granted={granted}>
        <SelectOrgPage />
      </AccessProvider>
    </MantineProvider>,
  );
}

describe("SelectOrgPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useAuthMock.mockReturnValue({ status: "authenticated" });
  });

  it("explains an empty organization list", () => {
    useTenantMock.mockReturnValue(tenantState());

    renderPage(DENIED);

    expect(screen.getByText(NO_ORGS_MESSAGE)).toBeInTheDocument();
  });

  it("shows the message and the create button when creation is granted", () => {
    useTenantMock.mockReturnValue(tenantState());

    renderPage(GRANTED);

    expect(screen.getByText(NO_ORGS_MESSAGE)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: CREATE_BUTTON })).toBeInTheDocument();
  });

  it("hides the create button when creation is not granted", () => {
    useTenantMock.mockReturnValue(
      tenantState({
        organizations: [{ id: "org-1", name: "Acme" }],
        currentOrganization: { id: "org-1", name: "Acme" },
      }),
    );

    renderPage(DENIED);

    expect(screen.queryByRole("button", { name: CREATE_BUTTON })).not.toBeInTheDocument();
    expect(screen.queryByText(NO_ORGS_MESSAGE)).not.toBeInTheDocument();
  });

  it("waits for the tenant before showing the empty list or the picker", () => {
    useTenantMock.mockReturnValue(tenantState({ ready: false }));

    renderPage(GRANTED);

    expect(screen.getByTestId("loading-screen")).toBeInTheDocument();
    expect(screen.queryByText(NO_ORGS_MESSAGE)).not.toBeInTheDocument();
    expect(screen.queryByTestId("org-picker")).not.toBeInTheDocument();
  });

  it("renders the picker once the tenant is ready with organizations", () => {
    useTenantMock.mockReturnValue(
      tenantState({
        organizations: [{ id: "org-1", name: "Acme" }],
        currentOrganization: { id: "org-1", name: "Acme" },
      }),
    );

    renderPage(DENIED);

    expect(screen.getByTestId("org-picker")).toBeInTheDocument();
    expect(screen.queryByText(NO_ORGS_MESSAGE)).not.toBeInTheDocument();
  });
});
