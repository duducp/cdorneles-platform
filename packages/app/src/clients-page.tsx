"use client";

import { permissionKey } from "@cdorneles/permissions";
import {
  Button,
  DataTable,
  EmptyState,
  PageBody,
  PageContainer,
  TableSkeleton,
  type DataTableProps,
} from "@cdorneles/ui";
import { PermissionGate } from "@cdorneles/ui/permissions";
import { Plus } from "lucide-react";
import { Text } from "@mantine/core";
import type { ComponentType, ReactNode } from "react";
import { useCallback, useEffect, useState } from "react";

import { useFunctionsApi } from "./functions-api-context";

interface ClientRow {
  id: string;
  name: string;
}

// Typed through DataTableProps so this app does not need a direct
// @tanstack/react-table dependency.
const columns: DataTableProps<ClientRow>["columns"] = [
  { accessorKey: "name", header: "Nome" },
];

/**
 * The admin's client-organizations resource list. The rows come from the
 * platform organizations API; the URL follows the platform pattern
 * (`/clients` list, `/clients/add` create).
 */
export function ClientsPage({
  linkComponent: Link,
}: {
  /** Anchor element for the "add" navigation; Next apps pass `next/link`. */
  linkComponent?: ComponentType<{ href: string; children?: ReactNode }>;
}) {
  const functionsApi = useFunctionsApi();
  const [clients, setClients] = useState<ClientRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    if (!functionsApi) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    void functionsApi
      .listOrganizations()
      .then((result) => setClients(result.organizations))
      .catch((cause) =>
        setError(cause instanceof Error ? cause.message : "Não foi possível carregar os clientes."),
      )
      .finally(() => setLoading(false));
  }, [functionsApi]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <PageContainer py="xl">
      <PageBody
        title="Clientes"
        description="Gerencie as organizações clientes."
        action={
          <PermissionGate permission={permissionKey("customers.create")}>
            <Button leftSection={<Plus size={16} />} component={Link} href="add">
              Novo cliente
            </Button>
          </PermissionGate>
        }
        toolbar={!loading && !error ? <Text c="dimmed" size="sm">{clients.length} clientes</Text> : undefined}
      >
        <PermissionGate
          permission={permissionKey("customers.read")}
          fallback={
            <EmptyState
              title="Acesso negado"
              description="Você não tem permissão para ver os clientes."
            />
          }
        >
          {error ? (
            <div role="alert">
              <EmptyState title="Não foi possível carregar os clientes" description={error} />
            </div>
          ) : loading ? (
            <TableSkeleton rows={6} columns={columns.length} />
          ) : clients.length === 0 ? (
            <EmptyState
              title="Nenhum cliente ainda"
              description="Adicione o primeiro cliente para começar."
            />
          ) : (
            <DataTable data={clients} columns={columns} withBorder={false} />
          )}
        </PermissionGate>
      </PageBody>
    </PageContainer>
  );
}
