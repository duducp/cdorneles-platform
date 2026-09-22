"use client";

import { permissionKey } from "@cdorneles/permissions";
import { useTenant } from "@cdorneles/tenant";
import {
  Button,
  DataTable,
  EmptyState,
  PageContainer,
  PageHeader,
  type DataTableProps,
} from "@cdorneles/ui";
import { PermissionGate } from "@cdorneles/ui/permissions";
import { Plus } from "lucide-react";

interface CustomerRow {
  id: string;
  name: string;
  email: string;
  phone: string;
  active: boolean;
}

// Typed through DataTableProps instead of LegacyColumnDef so this app does
// not need a direct @tanstack/react-table dependency.
const columns: DataTableProps<CustomerRow>["columns"] = [
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

export function CustomersPage() {
  const { currentOrganization } = useTenant();
  const organizationName = currentOrganization?.name ?? "your organization";

  return (
    <PageContainer py="xl">
      <PageHeader
        title="Customers"
        description={`Manage customers for ${organizationName}.`}
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

export default CustomersPage;
