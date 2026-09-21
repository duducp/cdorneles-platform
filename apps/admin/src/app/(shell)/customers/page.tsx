"use client";

import {
  Button,
  DataTable,
  EmptyState,
  PageContainer,
  PageHeader,
} from "@cdorneles/ui";
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
  { accessorKey: "name", header: "Name" },
  { accessorKey: "email", header: "Email" },
  { accessorKey: "phone", header: "Phone" },
  {
    accessorKey: "active",
    header: "Status",
    cell: ({ getValue }) => (getValue<boolean>() ? "Active" : "Inactive"),
  },
];

const MOCK_DATA: CustomerRow[] = [];

export default function CustomersPage() {
  return (
    <PageContainer py="xl">
      <PageHeader
        title="Customers"
        description="Manage your customers."
        actions={
          <PermissionGate permission={permissionKey("customers.create")}>
            <Button leftSection={<Plus size={16} />}>Add Customer</Button>
          </PermissionGate>
        }
      />
      <PermissionGate
        permission={permissionKey("customers.read")}
        fallback={
          <EmptyState
            title="Access denied"
            description="You don't have permission to view customers."
          />
        }
      >
        {MOCK_DATA.length === 0 ? (
          <EmptyState
            title="No customers yet"
            description="Add your first customer to get started."
          />
        ) : (
          <DataTable data={MOCK_DATA} columns={columns} />
        )}
      </PermissionGate>
    </PageContainer>
  );
}
