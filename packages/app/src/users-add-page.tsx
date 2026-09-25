"use client";

import { permissionKey, type PermissionKey } from "@cdorneles/permissions";
import type { Organization } from "@cdorneles/tenant";
import { useTenant } from "@cdorneles/tenant";
import { Button, EmptyState, FormError, PageBody, PageContainer } from "@cdorneles/ui";
import { PermissionGate, useAccess } from "@cdorneles/ui/permissions";
import { Checkbox, Group, Select, Stack, Text, TextInput } from "@mantine/core";
import { useCallback, useEffect, useState, type FormEvent } from "react";

import { useFunctionsApi } from "./functions-api-context";

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

export function UsersAddPage() {
  const functionsApi = useFunctionsApi();
  const { currentOrganization } = useTenant();
  const access = useAccess();
  const canManagePermissions = access.hasPermission(permissionKey("users.manage_permissions"));
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [organizationsError, setOrganizationsError] = useState<string | null>(null);

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
    loadOrganizations();
  }, [loadOrganizations]);

  return (
    <PageContainer py="xl">
      <PageBody
        title="Novo usuário"
        description="Cria um usuário de plataforma e define o acesso inicial."
      >
        <PermissionGate
          permission={permissionKey("users.create")}
          fallback={
            <EmptyState
              title="Acesso negado"
              description="Você não tem permissão para criar usuários."
            />
          }
        >
          <CreateUserForm
            organizations={organizations}
            organizationsError={organizationsError}
            defaultOrganizationId={currentOrganization?.id ?? null}
            canManagePermissions={canManagePermissions}
          />
        </PermissionGate>
      </PageBody>
    </PageContainer>
  );
}

function CreateUserForm({
  organizations,
  organizationsError,
  defaultOrganizationId,
  canManagePermissions,
}: {
  organizations: Organization[];
  organizationsError: string | null;
  defaultOrganizationId: string | null;
  canManagePermissions: boolean;
}) {
  const functionsApi = useFunctionsApi();
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [organizationId, setOrganizationId] = useState<string | null>(defaultOrganizationId);
  const [role, setRole] = useState<string | null>(null);
  const [permissions, setPermissions] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [created, setCreated] = useState(false);

  function togglePermission(permission: string, checked: boolean) {
    setPermissions((current) =>
      checked ? [...current, permission] : current.filter((value) => value !== permission),
    );
  }

  async function submit() {
    // Validation happens on submit and the button stays enabled: a disabled
    // submit hides why nothing happens (platform form checklist).
    if (!email || !name || !organizationId || !role) {
      setError("Preencha e-mail, nome, organização e papel.");
      return;
    }
    if (!functionsApi) {
      setError("API de plataforma não configurada neste ambiente.");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      await functionsApi.createUser({ email, name, organizationId, role, permissions });
      setCreated(true);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Não foi possível criar o usuário.");
    } finally {
      setSubmitting(false);
    }
  }

  if (created) {
    return (
      <EmptyState
        title="Usuário criado"
        description={`${name} (${email}) foi criado com sucesso. Volte à lista para ver os usuários.`}
      />
    );
  }

  return (
    <form
      onSubmit={(event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        void submit();
      }}
      noValidate
      aria-busy={submitting || undefined}
    >
      <Stack gap="md" maw={720}>
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
          <Button type="submit" loading={submitting}>
            Criar usuário
          </Button>
        </Group>
      </Stack>
    </form>
  );
}
