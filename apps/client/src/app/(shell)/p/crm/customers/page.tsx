"use client";

import { permissionKey } from "@cdorneles/permissions";
import { useTenant } from "@cdorneles/tenant";
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
import { TextInput } from "@mantine/core";
import { Plus, Search } from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import { PORTAL_PREFIX } from "@cdorneles/app";

interface CustomerRow {
  id: string;
  name: string;
  email: string;
  phone: string;
  active: boolean;
}

// Typed through DataTableProps so this app does not need a direct
// @tanstack/react-table dependency.
const columns: DataTableProps<CustomerRow>["columns"] = [
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

export default function CustomersPage() {
  const { currentOrganization } = useTenant();
  const organizationName = currentOrganization?.name ?? "sua organização";
  const [filter, setFilter] = useState("");
  const [customers, setCustomers] = useState<CustomerRow[]>([]);
  const [loading, setLoading] = useState(true);

  // The customers API is not wired yet; the load keeps the page's states
  // (skeleton → empty/table) in place for when it lands.
  useEffect(() => {
    let active = true;
    const timer = setTimeout(() => {
      if (active) {
        setCustomers(MOCK_DATA);
        setLoading(false);
      }
    }, 300);
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, []);

  const filtered = useMemo(() => {
    const term = filter.trim().toLowerCase();
    if (!term) return customers;
    return customers.filter(
      (customer) =>
        customer.name.toLowerCase().includes(term) || customer.email.toLowerCase().includes(term),
    );
  }, [filter, customers]);

  return (
    <PageContainer py="xl">
      <PageBody
        title="Clientes"
        description={`Gerencie os clientes de ${organizationName}.`}
        action={
          <PermissionGate permission={permissionKey("customers.create")}>
            <Button
              leftSection={<Plus size={16} />}
              component={Link}
              href={`${PORTAL_PREFIX}/crm/customers/add`}
            >
              Novo cliente
            </Button>
          </PermissionGate>
        }
        toolbar={
          <TextInput
            placeholder="Buscar clientes..."
            aria-label="Buscar clientes"
            leftSection={<Search size={14} aria-hidden />}
            size="xs"
            w={260}
            value={filter}
            onChange={(event) => setFilter(event.currentTarget.value)}
          />
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
          {loading ? (
            <TableSkeleton rows={6} columns={columns.length} />
          ) : filtered.length === 0 ? (
            <EmptyState
              title="Nenhum cliente ainda"
              description="Adicione o primeiro cliente para começar."
            />
          ) : (
            <DataTable data={filtered} columns={columns} withBorder={false} />
          )}
        </PermissionGate>
      </PageBody>
    </PageContainer>
  );
}
