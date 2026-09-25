"use client";

import { Button, DataTable, EmptyState, PageContainer, PageHeader } from "@cdorneles/ui";
import { PermissionGate } from "@cdorneles/ui/permissions";
import { permissionKey } from "@cdorneles/permissions";
import type { LegacyColumnDef } from "@tanstack/react-table/legacy";
import { Plus } from "lucide-react";

interface CustomerRow {
  id: string;
  name: string;
  email: string;
  phone: string;
  active: boolean;
}

const columns: LegacyColumnDef<CustomerRow, unknown>[] = [
  { accessorKey: "name", header: "Nome" },
  { accessorKey: "email", header: "E-mail" },
  { accessorKey: "phone", header: "Telefone" },
  {
    accessorKey: "active",
    header: "Situação",
    cell: ({ getValue }) => (getValue<boolean>() ? "Ativo" : "Inativo"),
  },
];

const MOCK_DATA: CustomerRow[] = [];

export default function ClientsPage() {
  return (
    <PageContainer py="xl">
      <PageHeader
        title="Clientes"
        description="Gerencie as organizações clientes."
        actions={
          <PermissionGate permission={permissionKey("customers.create")}>
            <Button leftSection={<Plus size={16} />}>Novo cliente</Button>
          </PermissionGate>
        }
      />
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
        ) : (
          <DataTable data={MOCK_DATA} columns={columns} />
        )}
      </PermissionGate>
    </PageContainer>
  );
}
