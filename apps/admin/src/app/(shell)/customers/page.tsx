import { PageContainer, PageHeader, EmptyState } from "@cdorneles/ui";
import { PermissionGate } from "@cdorneles/ui/permissions";
import { permissionKey } from "@cdorneles/permissions";

export default function CustomersPage() {
  return (
    <PageContainer py="xl">
      <PageHeader
        title="Customers"
        description="Manage your customers."
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
        <EmptyState
          title="No customers yet"
          description="Customers will appear here once added."
        />
      </PermissionGate>
    </PageContainer>
  );
}
