"use client";

import { permissionKey } from "@cdorneles/permissions";
import { Button, EmptyState, PageBody, PageContainer } from "@cdorneles/ui";
import { PermissionGate } from "@cdorneles/ui/permissions";
import type { ComponentType, ReactNode } from "react";
import { Plus } from "lucide-react";

interface ClientRow {
  id: string;
  name: string;
}

const MOCK_DATA: ClientRow[] = [];

/**
 * The admin's client-organizations resource list. The data source is not
 * wired yet (the page ships with the console shell); the URL follows the
 * platform pattern (`/clients` list, `/clients/add` create).
 */
export function ClientsPage({
  linkComponent: Link,
}: {
  /** Anchor element for the "add" navigation; Next apps pass `next/link`. */
  linkComponent?: ComponentType<{ href: string; children?: ReactNode }>;
}) {
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
          {MOCK_DATA.length === 0 ? (
            <EmptyState
              title="Nenhum cliente ainda"
              description="Adicione o primeiro cliente para começar."
            />
          ) : null}
        </PermissionGate>
      </PageBody>
    </PageContainer>
  );
}
