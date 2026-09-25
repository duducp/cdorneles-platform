"use client";

import { permissionKey, type PermissionKey } from "@cdorneles/permissions";
import type { Organization } from "@cdorneles/tenant";
import { useTenant } from "@cdorneles/tenant";
import {
  Button,
  DataTable,
  EmptyState,
  FormError,
  LoadingScreen,
  PageBody,
  PageContainer,
  type DataTableProps,
} from "@cdorneles/ui";
import { PermissionGate, useAccess } from "@cdorneles/ui/permissions";
import { CreateOrganizationForm } from "@cdorneles/ui/tenant";
import { Box, Checkbox, Group, Paper, Select, Stack, Text, TextInput, Title } from "@mantine/core";
import { Plus, X } from "lucide-react";
import { useCallback, useEffect, useState, type FormEvent } from "react";

import { useFunctionsApi } from "./functions-api-context";

export interface UserRow {
  id: string;
  email: string;
  name: string;
  labels: string[];
}

export interface CreateUserInput {
  email: string;
  name: string;
  organizationId: string;
  role: string;
  permissions: string[];
}

export interface PermissionGroup {
  resource: string;
  permissions: PermissionKey[];
}

/**
 * The resource permissions the admin UI knows about (a curated mirror of the
 * organization-seeded permissions). Platform capabilities (`users.*`,
 * `organizations.create`) are granted outside organization roles and are
 * deliberately absent.
 */
export const USER_PERMISSION_GROUPS: PermissionGroup[] = [
  {
    resource: "organizations",
    permissions: [permissionKey("organizations.read"), permissionKey("organizations.update")],
  },
  {
    resource: "customers",
    permissions: [
      permissionKey("customers.read"),
      permissionKey("customers.create"),
      permissionKey("customers.update"),
      permissionKey("customers.delete"),
    ],
  },
  {
    resource: "orders",
    permissions: [
      permissionKey("orders.read"),
      permissionKey("orders.create"),
      permissionKey("orders.update"),
      permissionKey("orders.delete"),
    ],
  },
  {
    resource: "invoices",
    permissions: [
      permissionKey("invoices.read"),
      permissionKey("invoices.create"),
      permissionKey("invoices.approve"),
    ],
  },
  {
    resource: "products",
    permissions: [
      permissionKey("products.read"),
      permissionKey("products.create"),
      permissionKey("products.update"),
      permissionKey("products.delete"),
    ],
  },
  {
    resource: "roles",
    permissions: [
      permissionKey("roles.read"),
      permissionKey("roles.create"),
      permissionKey("roles.update"),
      permissionKey("roles.delete"),
    ],
  },
  {
    resource: "features",
    permissions: [permissionKey("features.read"), permissionKey("features.manage")],
  },
  { resource: "audit", permissions: [permissionKey("audit.read")] },
];

export const USER_ROLES = ["owner", "admin", "member"] as const;

const columns: DataTableProps<UserRow>["columns"] = [
  { accessorKey: "email", header: "E-mail" },
  { accessorKey: "name", header: "Nome" },
  {
    accessorKey: "labels",
    header: "Rótulos",
    cell: ({ getValue }) => (getValue<string[]>() ?? []).join(", ") || "—",
  },
];

function CreateUserForm({
  organizations,
  organizationsError,
  defaultOrganizationId,
  canManagePermissions,
  onCreate,
  onCancel,
}: {
  organizations: Organization[];
  organizationsError: string | null;
  defaultOrganizationId: string | null;
  canManagePermissions: boolean;
  onCreate: (input: CreateUserInput) => Promise<void>;
  onCancel: () => void;
}) {
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [organizationId, setOrganizationId] = useState<string | null>(defaultOrganizationId);
  const [role, setRole] = useState<string | null>(null);
  const [permissions, setPermissions] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function togglePermission(permission: string, checked: boolean) {
    setPermissions((current) =>
      checked ? [...current, permission] : current.filter((value) => value !== permission),
    );
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void submit();
  }

  async function submit() {
    // Validation happens on submit and the button stays enabled: a disabled
    // submit hides why nothing happens (platform form checklist).
    if (!email || !name || !organizationId || !role) {
      setError("Preencha e-mail, nome, organização e papel.");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      await onCreate({ email, name, organizationId, role, permissions });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Não foi possível criar o usuário.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} noValidate aria-busy={submitting || undefined}>
      <Stack gap="md">
        <FormError>{error}</FormError>
        {organizationsError ? <FormError>{organizationsError}</FormError> : null}
        <Group grow align="flex-start">
          <TextInput
            label="E-mail"
            value={email}
            onChange={(event) => setEmail(event.currentTarget.value)}
          />
          <TextInput
            label="Nome"
            value={name}
            onChange={(event) => setName(event.currentTarget.value)}
          />
        </Group>
        <Group grow align="flex-start">
          <Select
            label="Organização"
            placeholder="Selecione uma organização"
            data={organizations.map((organization) => ({
              value: organization.id,
              label: organization.name,
            }))}
            value={organizationId}
            onChange={setOrganizationId}
          />
          <Select
            label="Papel"
            placeholder="Selecione um papel"
            data={USER_ROLES.map((value) => ({ value, label: value }))}
            value={role}
            onChange={setRole}
          />
        </Group>
        {canManagePermissions ? (
          <Stack gap="xs">
            <Text fw={600}>Permissões</Text>
            {USER_PERMISSION_GROUPS.map((group) => (
              <Stack key={group.resource} gap={4}>
                <Text size="sm" fw={500} tt="capitalize">
                  {group.resource}
                </Text>
                {group.permissions.map((permission) => (
                  <Checkbox
                    key={permission}
                    label={permission}
                    checked={permissions.includes(permission)}
                    onChange={(event) => togglePermission(permission, event.currentTarget.checked)}
                  />
                ))}
              </Stack>
            ))}
          </Stack>
        ) : null}
        <Group justify="flex-end">
          <Button variant="subtle" type="button" onClick={onCancel} disabled={submitting}>
            Cancelar
          </Button>
          <Button type="submit" loading={submitting}>
            Criar usuário
          </Button>
        </Group>
      </Stack>
    </form>
  );
}

export function UsersPage() {
  const functionsApi = useFunctionsApi();
  const { currentOrganization, createOrganization } = useTenant();
  const access = useAccess();
  const canRead = access.hasPermission(permissionKey("users.read"));
  const canCreate = access.hasPermission(permissionKey("users.create"));
  const canManagePermissions = access.hasPermission(permissionKey("users.manage_permissions"));
  const canCreateOrganizations = access.hasPermission(permissionKey("organizations.create"));
  const [users, setUsers] = useState<UserRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [organizationsError, setOrganizationsError] = useState<string | null>(null);
  // The create form lives in the page body (Appwrite-console style), toggled
  // by the "New user" action — no modal.
  const [formOpen, setFormOpen] = useState(false);
  const [createOrgOpen, setCreateOrgOpen] = useState(false);

  const load = useCallback(() => {
    if (!functionsApi) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    void functionsApi
      .listUsers()
      .then((result) => setUsers(result.users))
      .catch((cause) =>
        setError(cause instanceof Error ? cause.message : "Não foi possível carregar os usuários."),
      )
      .finally(() => setLoading(false));
  }, [functionsApi]);

  const loadOrganizations = useCallback(() => {
    if (!functionsApi) return;
    setOrganizationsError(null);
    void functionsApi
      .listOrganizations()
      .then((result) => setOrganizations(result.organizations))
      .catch((cause) =>
        setOrganizationsError(
          cause instanceof Error ? cause.message : "Não foi possível carregar as organizações.",
        ),
      );
  }, [functionsApi]);

  useEffect(() => {
    if (canRead) load();
  }, [canRead, load]);

  useEffect(() => {
    if (canRead) loadOrganizations();
  }, [canRead, loadOrganizations]);

  const handleCreate = useCallback(
    async (input: CreateUserInput) => {
      if (!functionsApi) return;
      await functionsApi.createUser(input);
      setFormOpen(false);
      load();
    },
    [functionsApi, load],
  );

  const handleCreateOrganization = useCallback(
    async (name: string) => {
      await createOrganization(name, { makeActive: false });
      setCreateOrgOpen(false);
      loadOrganizations();
    },
    [createOrganization, loadOrganizations],
  );

  return (
    <PageContainer py="xl">
      <PageBody
        title="Usuários"
        description="Gerencie os usuários da plataforma e suas permissões."
        action={
          <Group gap="xs" wrap="nowrap">
            <PermissionGate permission={permissionKey("organizations.create")}>
              {createOrgOpen ? (
                <Button
                  variant="secondary"
                  leftSection={<X size={16} />}
                  onClick={() => setCreateOrgOpen(false)}
                >
                  Fechar
                </Button>
              ) : (
                <Button
                  variant="secondary"
                  leftSection={<Plus size={16} />}
                  onClick={() => setCreateOrgOpen(true)}
                >
                  Nova organização
                </Button>
              )}
            </PermissionGate>
            <PermissionGate permission={permissionKey("users.create")}>
              {formOpen ? (
                <Button
                  variant="secondary"
                  leftSection={<X size={16} />}
                  onClick={() => setFormOpen(false)}
                >
                  Fechar
                </Button>
              ) : (
                <Button leftSection={<Plus size={16} />} onClick={() => setFormOpen(true)}>
                  Novo usuário
                </Button>
              )}
            </PermissionGate>
          </Group>
        }
        toolbar={
          canCreate ? (
            <Text size="sm" c="dimmed">
              {users.length} usuários
            </Text>
          ) : undefined
        }
      >
        <PermissionGate
          permission={permissionKey("users.read")}
          fallback={
            <EmptyState
              title="Acesso negado"
              description="Você não tem permissão para ver os usuários."
            />
          }
        >
          <Stack gap="md">
            {canCreateOrganizations && createOrgOpen ? (
              <Paper radius="md" p="lg">
                <Title order={3} fz="md" mb="sm">
                  Nova organização
                </Title>
                <Box maw={480}>
                  <CreateOrganizationForm
                    onCreate={handleCreateOrganization}
                    onCancel={() => setCreateOrgOpen(false)}
                  />
                </Box>
              </Paper>
            ) : null}

            {canCreate && formOpen ? (
              <Paper radius="md" p="lg">
                <Title order={3} fz="md" mb="sm">
                  Novo usuário
                </Title>
                <CreateUserForm
                  organizations={organizations}
                  organizationsError={organizationsError}
                  defaultOrganizationId={currentOrganization?.id ?? null}
                  canManagePermissions={canManagePermissions}
                  onCreate={handleCreate}
                  onCancel={() => setFormOpen(false)}
                />
              </Paper>
            ) : null}

            {error ? (
              <div role="alert">
                <EmptyState title="Não foi possível carregar os usuários" description={error} />
              </div>
            ) : loading ? (
              <LoadingScreen />
            ) : users.length === 0 ? (
              <EmptyState
                title="Nenhum usuário ainda"
                description="Crie o primeiro usuário para começar."
              />
            ) : (
              <DataTable data={users} columns={columns} withBorder={false} />
            )}
          </Stack>
        </PermissionGate>
      </PageBody>
    </PageContainer>
  );
}
