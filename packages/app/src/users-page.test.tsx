import "@testing-library/jest-dom/vitest";

import type { FunctionsApi } from "@cdorneles/api-client";
import type { GrantedAccess } from "@cdorneles/permissions";
import { permissionKey } from "@cdorneles/permissions";
import { AccessProvider } from "@cdorneles/ui/permissions";
import { MantineProvider } from "@mantine/core";
import type * as MantineCore from "@mantine/core";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { useTenantMock } = vi.hoisted(() => ({ useTenantMock: vi.fn() }));

vi.mock("@cdorneles/tenant", () => ({ useTenant: useTenantMock }));

vi.mock("@cdorneles/ui", () => ({
  Button: ({
    children,
    onClick,
    type,
    disabled,
  }: {
    children?: ReactNode;
    onClick?: () => void;
    type?: "button" | "submit";
    disabled?: boolean;
  }) => (
    <button type={type ?? "button"} onClick={onClick} disabled={disabled}>
      {children}
    </button>
  ),
  DataTable: ({ data }: { data: { id: string; email: string }[] }) => (
    <ul data-testid="users-table">
      {data.map((row) => (
        <li key={row.id}>{row.email}</li>
      ))}
    </ul>
  ),
  EmptyState: ({ title, description }: { title: string; description?: string }) => (
    <div data-testid="empty-state">
      {title}
      {description ? ` — ${description}` : ""}
    </div>
  ),
  LoadingScreen: () => <div data-testid="loading-screen" />,
  PageContainer: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
  PageHeader: ({ title, actions }: { title?: ReactNode; actions?: ReactNode }) => (
    <header>
      <h1>{title}</h1>
      {actions}
    </header>
  ),
}));

// Keep the real Mantine provider/inputs, but swap Select and Modal for plain
// DOM equivalents so the form is driven the way a user would drive a native
// control (no combobox portal/timers in jsdom).
vi.mock("@mantine/core", async (importOriginal) => {
  const actual = await importOriginal<typeof MantineCore>();
  return {
    ...actual,
    Modal: ({ opened, children }: { opened?: boolean; children?: ReactNode }) =>
      opened ? <div role="dialog">{children}</div> : null,
    Select: ({
      label,
      data,
      value,
      onChange,
    }: {
      label?: string;
      data?: { value: string; label: string }[];
      value?: string | null;
      onChange?: (value: string | null) => void;
    }) => (
      <label>
        {label}
        <select
          aria-label={label}
          value={value ?? ""}
          onChange={(event) => onChange?.(event.currentTarget.value)}
        >
          <option value="" />
          {(data ?? []).map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </label>
    ),
  };
});

const { FunctionsApiProvider, useFunctionsApi } = await import("./functions-api-context");
const { UsersPage } = await import("./users-page");

const READ: GrantedAccess = { permissions: [permissionKey("users.read")], features: [] };
const READ_CREATE: GrantedAccess = {
  permissions: [
    permissionKey("users.read"),
    permissionKey("users.create"),
    permissionKey("users.manage_permissions"),
  ],
  features: [],
};
const READ_CREATE_NO_MANAGE: GrantedAccess = {
  permissions: [permissionKey("users.read"), permissionKey("users.create")],
  features: [],
};
const READ_CREATE_ORG: GrantedAccess = {
  permissions: [
    permissionKey("users.read"),
    permissionKey("users.create"),
    permissionKey("organizations.create"),
  ],
  features: [],
};
const DENIED: GrantedAccess = { permissions: [], features: [] };

function tenantState() {
  return {
    organizations: [{ id: "org-1", name: "Acme" }],
    currentOrganization: { id: "org-1", name: "Acme" },
    ready: true,
    switchOrganization: vi.fn(),
    createOrganization: vi.fn(),
  };
}

function renderPage(granted: GrantedAccess, functionsApi: Partial<FunctionsApi> | null) {
  const value =
    functionsApi === null
      ? null
      : ({
          listOrganizations: vi.fn().mockResolvedValue({
            organizations: [{ id: "org-1", name: "Acme" }],
          }),
          ...functionsApi,
        } as FunctionsApi);
  return render(
    <MantineProvider>
      <FunctionsApiProvider value={value}>
        <AccessProvider granted={granted}>
          <UsersPage />
        </AccessProvider>
      </FunctionsApiProvider>
    </MantineProvider>,
  );
}

const ONE_USER = { users: [{ id: "u1", email: "ada@example.com", name: "Ada", labels: [] }] };

describe("UsersPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useTenantMock.mockReturnValue(tenantState());
  });

  it("lists users when users.read is granted", async () => {
    const listUsers = vi.fn().mockResolvedValue(ONE_USER);

    renderPage(READ, { listUsers });

    expect(await screen.findByText("ada@example.com")).toBeInTheDocument();
    expect(screen.getByTestId("users-table")).toBeInTheDocument();
    expect(listUsers).toHaveBeenCalled();
  });

  it("denies the list without users.read and does not fetch", async () => {
    const listUsers = vi.fn().mockResolvedValue(ONE_USER);

    renderPage(DENIED, { listUsers });

    expect(await screen.findByTestId("empty-state")).toHaveTextContent("Access denied");
    expect(listUsers).not.toHaveBeenCalled();
  });

  it("renders without an api (unconfigured build) without throwing or fetching", async () => {
    renderPage(READ, null);

    expect(await screen.findByText(/No users yet/)).toBeInTheDocument();
  });

  it("throws when the hook is used with no provider at all", () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    function Probe() {
      useFunctionsApi();
      return null;
    }

    expect(() => render(<Probe />)).toThrow(/FunctionsApiProvider/);
    errorSpy.mockRestore();
  });

  it("loads organizations from the platform API when users.read is granted", async () => {
    const listOrganizations = vi.fn().mockResolvedValue({
      organizations: [{ id: "org-1", name: "Acme" }],
    });

    renderPage(READ, { listUsers: vi.fn().mockResolvedValue(ONE_USER), listOrganizations });

    await waitFor(() => expect(listOrganizations).toHaveBeenCalled());
  });

  it("does not load organizations without users.read", async () => {
    const listOrganizations = vi.fn().mockResolvedValue({ organizations: [] });

    renderPage(DENIED, { listUsers: vi.fn().mockResolvedValue(ONE_USER), listOrganizations });

    expect(await screen.findByTestId("empty-state")).toHaveTextContent("Access denied");
    expect(listOrganizations).not.toHaveBeenCalled();
  });

  it("offers the platform organizations in the form, not the tenant's membership list", async () => {
    const listOrganizations = vi.fn().mockResolvedValue({
      organizations: [{ id: "org-9", name: "Globex" }],
    });

    renderPage(READ_CREATE, {
      listUsers: vi.fn().mockResolvedValue({ users: [] }),
      listOrganizations,
    });

    await userEvent.click(await screen.findByRole("button", { name: /new user/i }));

    expect(await screen.findByRole("option", { name: "Globex" })).toBeInTheDocument();
    expect(screen.queryByRole("option", { name: "Acme" })).not.toBeInTheDocument();
  });

  it("surfaces a load failure above the organization field", async () => {
    const listOrganizations = vi.fn().mockRejectedValue(new Error("boom"));

    renderPage(READ_CREATE, {
      listUsers: vi.fn().mockResolvedValue({ users: [] }),
      listOrganizations,
    });

    await waitFor(() => expect(listOrganizations).toHaveBeenCalled());
    await userEvent.click(await screen.findByRole("button", { name: /new user/i }));

    expect(await screen.findByRole("alert")).toHaveTextContent("boom");
  });

  it("shows the 'New user' action when users.create is granted", async () => {
    renderPage(READ_CREATE, { listUsers: vi.fn().mockResolvedValue(ONE_USER) });

    expect(await screen.findByRole("button", { name: /new user/i })).toBeInTheDocument();
  });

  it("hides the 'New user' action without users.create", async () => {
    renderPage(READ, { listUsers: vi.fn().mockResolvedValue(ONE_USER) });

    expect(await screen.findByText("ada@example.com")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /new user/i })).not.toBeInTheDocument();
  });

  it("shows the 'New organization' action when organizations.create is granted", async () => {
    renderPage(READ_CREATE_ORG, { listUsers: vi.fn().mockResolvedValue(ONE_USER) });

    expect(await screen.findByRole("button", { name: /new organization/i })).toBeInTheDocument();
  });

  it("hides the 'New organization' action without organizations.create", async () => {
    renderPage(READ_CREATE, { listUsers: vi.fn().mockResolvedValue(ONE_USER) });

    expect(await screen.findByText("ada@example.com")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /new organization/i })).not.toBeInTheDocument();
  });

  it("creates an organization and refreshes the platform list", async () => {
    const listOrganizations = vi
      .fn()
      .mockResolvedValueOnce({ organizations: [{ id: "org-1", name: "Acme" }] })
      .mockResolvedValueOnce({
        organizations: [
          { id: "org-1", name: "Acme" },
          { id: "org-9", name: "New Org" },
        ],
      });
    const createOrganization = vi.fn().mockResolvedValue({ id: "org-9", name: "New Org" });
    useTenantMock.mockReturnValue({ ...tenantState(), createOrganization });

    renderPage(READ_CREATE_ORG, {
      listUsers: vi.fn().mockResolvedValue({ users: [] }),
      listOrganizations,
    });

    await userEvent.click(await screen.findByRole("button", { name: /new organization/i }));
    await userEvent.type(await screen.findByLabelText(/^Organization name/), "New Org");
    await userEvent.click(screen.getByRole("button", { name: /create organization/i }));

    expect(createOrganization).toHaveBeenCalledWith("New Org", { makeActive: false });
    await waitFor(() => expect(listOrganizations).toHaveBeenCalledTimes(2));

    await userEvent.click(await screen.findByRole("button", { name: /new user/i }));
    expect(await screen.findByRole("option", { name: "New Org" })).toBeInTheDocument();
  });

  it("hides the permission checklist without users.manage_permissions", async () => {
    renderPage(READ_CREATE_NO_MANAGE, {
      listUsers: vi.fn().mockResolvedValue({ users: [] }),
      createUser: vi.fn().mockResolvedValue({ userId: "u2" }),
    });

    await userEvent.click(await screen.findByRole("button", { name: /new user/i }));

    expect(await screen.findByLabelText(/^Email/)).toBeInTheDocument();
    expect(screen.queryByText("Permissions")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("customers.read")).not.toBeInTheDocument();
  });

  it("prefills the organization and keeps create disabled until required fields are set", async () => {
    renderPage(READ_CREATE, { listUsers: vi.fn().mockResolvedValue({ users: [] }) });

    await userEvent.click(await screen.findByRole("button", { name: /new user/i }));
    await screen.findByLabelText(/^Email/);

    expect(screen.getByLabelText("Organization")).toHaveValue("org-1");
    const create = screen.getByRole("button", { name: /create user/i });
    expect(create).toBeDisabled();

    await userEvent.type(screen.getByLabelText(/^Email/), "ada@example.com");
    await userEvent.type(screen.getByLabelText(/^Name/), "Ada Lovelace");
    await userEvent.selectOptions(screen.getByLabelText("Role"), "member");

    expect(create).toBeEnabled();
  });

  it("offers the org-seeded organization permissions but not the platform capability", async () => {
    renderPage(READ_CREATE, { listUsers: vi.fn().mockResolvedValue({ users: [] }) });

    await userEvent.click(await screen.findByRole("button", { name: /new user/i }));

    expect(await screen.findByLabelText("organizations.read")).toBeInTheDocument();
    expect(screen.getByLabelText("organizations.update")).toBeInTheDocument();
    expect(screen.queryByLabelText("organizations.create")).not.toBeInTheDocument();
  });

  it("creates a user with the email, name, organization, role and permissions", async () => {
    const createUser = vi.fn().mockResolvedValue({ userId: "u2" });
    const listUsers = vi.fn().mockResolvedValue({ users: [] });

    renderPage(READ_CREATE, { listUsers, createUser });

    await userEvent.click(await screen.findByRole("button", { name: /new user/i }));

    await userEvent.type(await screen.findByLabelText(/^Email/), "ada@example.com");
    await userEvent.type(screen.getByLabelText(/^Name/), "Ada Lovelace");
    await userEvent.selectOptions(screen.getByLabelText("Organization"), "org-1");
    await userEvent.selectOptions(screen.getByLabelText("Role"), "member");
    await userEvent.click(screen.getByLabelText("customers.read"));
    await userEvent.click(screen.getByRole("button", { name: /create user/i }));

    expect(createUser).toHaveBeenCalledWith({
      email: "ada@example.com",
      name: "Ada Lovelace",
      organizationId: "org-1",
      role: "member",
      permissions: ["customers.read"],
    });
  });
});
