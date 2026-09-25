import "@testing-library/jest-dom/vitest";

import type { FunctionsApi } from "@cdorneles/api-client";
import type { GrantedAccess } from "@cdorneles/permissions";
import { permissionKey } from "@cdorneles/permissions";
import { AccessProvider } from "@cdorneles/ui/permissions";
import { MantineProvider } from "@mantine/core";
import type * as MantineCore from "@mantine/core";
import { render, screen } from "@testing-library/react";
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
    href,
  }: {
    children?: ReactNode;
    onClick?: () => void;
    type?: "button" | "submit";
    href?: string;
  }) => (
    <button type={type ?? "button"} onClick={onClick} data-href={href}>
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
  FormError: ({ children }: { children?: ReactNode }) =>
    children ? <div role="alert">{children}</div> : null,
  LoadingScreen: () => <div data-testid="loading-screen" />,
  TableSkeleton: ({ rows }: { rows?: number }) => (
    <div data-testid="table-skeleton" aria-label={`${rows ?? 6} linhas`} />
  ),
  PageBody: ({
    title,
    action,
    toolbar,
    children,
  }: {
    title?: ReactNode;
    action?: ReactNode;
    toolbar?: ReactNode;
    children?: ReactNode;
  }) => (
    <div>
      <header>
        <h2>{title}</h2>
        {action}
      </header>
      {toolbar}
      {children}
    </div>
  ),
  PageContainer: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
}));

// Keep the real Mantine provider/inputs, but swap Select for a plain DOM
// equivalent so the form is driven the way a user would drive a native
// control (no combobox portal/timers in jsdom).
vi.mock("@mantine/core", async (importOriginal) => {
  const actual = await importOriginal<typeof MantineCore>();
  return {
    ...actual,
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
const { UsersListPage } = await import("./users-list-page");
const { UsersAddPage } = await import("./users-add-page");

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

function renderPage(
  granted: GrantedAccess,
  functionsApi: Partial<FunctionsApi> | null,
  page: "list" | "add" = "list",
) {
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
          {page === "list" ? <UsersListPage /> : <UsersAddPage />}
        </AccessProvider>
      </FunctionsApiProvider>
    </MantineProvider>,
  );
}

const ONE_USER = { users: [{ id: "u1", email: "ada@example.com", name: "Ada", labels: [] }] };

describe("UsersListPage", () => {
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

    expect(await screen.findByTestId("empty-state")).toHaveTextContent("Acesso negado");
    expect(listUsers).not.toHaveBeenCalled();
  });

  it("renders without an api (unconfigured build) without throwing or fetching", async () => {
    renderPage(READ, null);

    expect(await screen.findByText(/Nenhum usuário ainda/)).toBeInTheDocument();
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

  it("shows the 'Novo usuário' action only when users.create is granted", async () => {
    renderPage(READ_CREATE, { listUsers: vi.fn().mockResolvedValue(ONE_USER) });

    await screen.findByText("ada@example.com");
    expect(screen.getByRole("button", { name: /novo usuário/i })).toBeInTheDocument();
  });

  it("hides the 'Novo usuário' action without users.create", async () => {
    renderPage(DENIED, { listUsers: vi.fn().mockResolvedValue(ONE_USER) });

    expect(await screen.findByTestId("empty-state")).toHaveTextContent("Acesso negado");
    expect(screen.queryByRole("button", { name: /novo usuário/i })).not.toBeInTheDocument();
  });

  it("shows the 'Nova organização' action when organizations.create is granted", async () => {
    renderPage(READ_CREATE_ORG, { listUsers: vi.fn().mockResolvedValue(ONE_USER) });

    await screen.findByText("ada@example.com");
    expect(screen.getByRole("button", { name: /nova organização/i })).toBeInTheDocument();
  });

  it("hides the 'Nova organização' action without organizations.create", async () => {
    renderPage(READ_CREATE, { listUsers: vi.fn().mockResolvedValue(ONE_USER) });

    await screen.findByText("ada@example.com");
    expect(screen.queryByRole("button", { name: /nova organização/i })).not.toBeInTheDocument();
  });

  it("shows the user count in the toolbar", async () => {
    renderPage(READ, { listUsers: vi.fn().mockResolvedValue(ONE_USER) });

    expect(await screen.findByText(/1 usuário/)).toBeInTheDocument();
  });

  it("shows the table skeleton while loading instead of a full-page loader", async () => {
    renderPage(READ, {
      listUsers: vi.fn().mockReturnValue(new Promise(() => {})),
    });

    expect(await screen.findByTestId("table-skeleton")).toBeInTheDocument();
    expect(screen.queryByTestId("loading-screen")).not.toBeInTheDocument();
  });
});

describe("UsersAddPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useTenantMock.mockReturnValue(tenantState());
  });

  it("prefills the organization from the active tenant", async () => {
    renderPage(
      READ_CREATE,
      {
        listUsers: vi.fn().mockResolvedValue({ users: [] }),
      },
      "add",
    );

    expect(await screen.findByLabelText("Organização")).toHaveValue("org-1");
  });

  it("denies the form without users.create", async () => {
    renderPage(READ, { listUsers: vi.fn().mockResolvedValue({ users: [] }) }, "add");

    expect(await screen.findByTestId("empty-state")).toHaveTextContent("Acesso negado");
  });

  it("validates required fields on submit with the button enabled", async () => {
    renderPage(
      READ_CREATE,
      {
        listUsers: vi.fn().mockResolvedValue({ users: [] }),
      },
      "add",
    );

    await screen.findByLabelText(/^E-mail/);

    const create = screen.getByRole("button", { name: /criar usuário/i });
    expect(create).toBeEnabled();

    await userEvent.click(create);
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Preencha e-mail, nome, organização e papel.",
    );
  });

  it("creates a user with the email, name, organization, role and permissions", async () => {
    const createUser = vi.fn().mockResolvedValue({ userId: "u2" });

    renderPage(
      READ_CREATE,
      {
        listUsers: vi.fn().mockResolvedValue({ users: [] }),
        createUser,
      },
      "add",
    );

    await userEvent.type(await screen.findByLabelText(/^E-mail/), "ada@example.com");
    await userEvent.type(screen.getByLabelText(/^Nome/), "Ada Lovelace");
    await userEvent.selectOptions(screen.getByLabelText("Organização"), "org-1");
    await userEvent.selectOptions(screen.getByLabelText("Papel"), "member");
    await userEvent.click(screen.getByLabelText("customers.read"));
    await userEvent.click(screen.getByRole("button", { name: /criar usuário/i }));

    expect(createUser).toHaveBeenCalledWith({
      email: "ada@example.com",
      name: "Ada Lovelace",
      organizationId: "org-1",
      role: "member",
      permissions: ["customers.read"],
    });
  });

  it("shows a success state after creating", async () => {
    const createUser = vi.fn().mockResolvedValue({ userId: "u2" });

    renderPage(
      READ_CREATE,
      {
        listUsers: vi.fn().mockResolvedValue({ users: [] }),
        createUser,
      },
      "add",
    );

    await userEvent.type(await screen.findByLabelText(/^E-mail/), "ada@example.com");
    await userEvent.type(screen.getByLabelText(/^Nome/), "Ada Lovelace");
    await userEvent.selectOptions(screen.getByLabelText("Organização"), "org-1");
    await userEvent.selectOptions(screen.getByLabelText("Papel"), "member");
    await userEvent.click(screen.getByRole("button", { name: /criar usuário/i }));

    expect(await screen.findByText(/Usuário criado/)).toBeInTheDocument();
  });

  it("hides the permission checklist without users.manage_permissions", async () => {
    renderPage(
      READ_CREATE_NO_MANAGE,
      {
        listUsers: vi.fn().mockResolvedValue({ users: [] }),
      },
      "add",
    );

    await userEvent.type(await screen.findByLabelText(/^E-mail/), "a@b.co");
    await userEvent.type(screen.getByLabelText(/^Nome/), "Ada");
    await userEvent.selectOptions(screen.getByLabelText("Organização"), "org-1");
    await userEvent.selectOptions(screen.getByLabelText("Papel"), "member");

    expect(screen.queryByText("Permissões")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("customers.read")).not.toBeInTheDocument();
  });

  it("surfaces a creation failure in the inline FormError", async () => {
    const createUser = vi.fn().mockRejectedValue(new Error("boom"));

    renderPage(
      READ_CREATE,
      {
        listUsers: vi.fn().mockResolvedValue({ users: [] }),
        createUser,
      },
      "add",
    );

    await userEvent.type(await screen.findByLabelText(/^E-mail/), "a@b.co");
    await userEvent.type(screen.getByLabelText(/^Nome/), "Ada");
    await userEvent.selectOptions(screen.getByLabelText("Organização"), "org-1");
    await userEvent.selectOptions(screen.getByLabelText("Papel"), "member");
    await userEvent.click(screen.getByRole("button", { name: /criar usuário/i }));

    expect(await screen.findByRole("alert")).toHaveTextContent("boom");
  });
});
