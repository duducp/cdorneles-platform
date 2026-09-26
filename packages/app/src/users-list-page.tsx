"use client";

import { permissionKey } from "@cdorneles/permissions";
import { useTenant } from "@cdorneles/tenant";
import {
  Button,
  DataTable,
  EmptyState,
  ErrorState,
  PageBody,
  PageContainer,
  TableSkeleton,
  type DataTableProps,
} from "@cdorneles/ui";
import { PermissionGate, useAccess } from "@cdorneles/ui/permissions";
import { CreateOrganizationForm } from "@cdorneles/ui/tenant";
import { Box, Group, Paper, Text, Title } from "@mantine/core";
import { Plus, X } from "lucide-react";
import type { ComponentType, ReactNode } from "react";
import { useCallback, useEffect, useState } from "react";

import { useFunctionsApi } from "./functions-api-context";

export interface UserRow {
  id: string;
  email: string;
  name: string;
  labels: string[];
}

const columns: DataTableProps<UserRow>["columns"] = [
  { accessorKey: "email", header: "E-mail" },
  { accessorKey: "name", header: "Nome" },
  {
    accessorKey: "labels",
    header: "Rótulos",
    cell: ({ getValue }) => (getValue<string[]>() ?? []).join(", ") || "—",
  },
];

/** Inline "new organization" panel toggle, gated by organizations.create. */
function CreateOrganizationPanel({ onOpenChange }: { onOpenChange: (open: boolean) => void }) {
  const { createOrganization } = useTenant();

  return (
    <Paper radius="md" p="lg">
      <Title order={3} fz="md" mb="sm">
        Nova organização
      </Title>
      <Box maw={480}>
        <CreateOrganizationForm
          onCreate={async (name) => {
            await createOrganization(name, { makeActive: false });
            onOpenChange(false);
          }}
          onCancel={() => onOpenChange(false)}
        />
      </Box>
    </Paper>
  );
}

export function UsersListPage({
  linkComponent: Link,
}: {
  /** Anchor element for the "add" navigation; Next apps pass `next/link`. */
  linkComponent?: ComponentType<{ href: string; children?: ReactNode }>;
}) {
  const functionsApi = useFunctionsApi();
  const access = useAccess();
  const canRead = access.hasPermission(permissionKey("users.read"));
  const canCreate = access.hasPermission(permissionKey("users.create"));
  const canCreateOrganizations = access.hasPermission(permissionKey("organizations.create"));
  const [users, setUsers] = useState<UserRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
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

  useEffect(() => {
    if (canRead) load();
  }, [canRead, load]);

  return (
    <PageContainer py="xl">
      <PageBody
        title="Usuários"
        description="Gerencie os usuários da plataforma e suas permissões."
        action={
          <Group gap="xs" wrap="nowrap">
            {canCreateOrganizations ? (
              createOrgOpen ? (
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
              )
            ) : null}
            {canCreate ? (
              <Button leftSection={<Plus size={16} />} component={Link} href="add">
                Novo usuário
              </Button>
            ) : null}
          </Group>
        }
        toolbar={
          canRead ? (
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
          {canCreateOrganizations && createOrgOpen ? (
            <CreateOrganizationPanel onOpenChange={setCreateOrgOpen} />
          ) : null}

          {error ? (
            <ErrorState
              title="Não foi possível carregar os usuários"
              description={error}
              onRetry={load}
              retryLabel="Tentar novamente"
            />
          ) : loading ? (
            <TableSkeleton rows={6} columns={columns.length} />
          ) : users.length === 0 ? (
            <EmptyState
              title="Nenhum usuário ainda"
              description="Crie o primeiro usuário para começar."
            />
          ) : (
            <DataTable data={users} columns={columns} withBorder={false} />
          )}
        </PermissionGate>
      </PageBody>
    </PageContainer>
  );
}
