"use client";

import { permissionKey } from "@cdorneles/permissions";
import { useTenant } from "@cdorneles/tenant";
import {
  Button,
  DataTable,
  EmptyState,
  FormError,
  PageBody,
  PageContainer,
  type DataTableProps,
} from "@cdorneles/ui";
import { PermissionGate } from "@cdorneles/ui/permissions";
import { Group, Paper, Stack, TextInput, Title } from "@mantine/core";
import { Plus, Search, X } from "lucide-react";
import { useMemo, useState, type FormEvent } from "react";

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

function CreateCustomerForm({ onCancel }: { onCancel: () => void }) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      // The customers API is not wired yet; the form is the console pattern.
      await new Promise((resolve) => setTimeout(resolve, 300));
      onCancel();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not create the customer.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} aria-busy={submitting || undefined} noValidate>
      <Stack gap="md" maw={560}>
        <FormError>{error}</FormError>
        <TextInput
          label="Name"
          required
          value={name}
          onChange={(event) => setName(event.currentTarget.value)}
        />
        <TextInput
          label="Email"
          type="email"
          value={email}
          onChange={(event) => setEmail(event.currentTarget.value)}
        />
        <TextInput
          label="Phone"
          value={phone}
          onChange={(event) => setPhone(event.currentTarget.value)}
        />
        <Group justify="flex-end">
          <Button variant="subtle" type="button" onClick={onCancel} disabled={submitting}>
            Cancel
          </Button>
          <Button type="submit" loading={submitting}>
            Create customer
          </Button>
        </Group>
      </Stack>
    </form>
  );
}

export function CustomersPage() {
  const { currentOrganization } = useTenant();
  const organizationName = currentOrganization?.name ?? "your organization";
  const [formOpen, setFormOpen] = useState(false);
  const [filter, setFilter] = useState("");

  const filtered = useMemo(() => {
    const term = filter.trim().toLowerCase();
    if (!term) return MOCK_DATA;
    return MOCK_DATA.filter(
      (customer) =>
        customer.name.toLowerCase().includes(term) || customer.email.toLowerCase().includes(term),
    );
  }, [filter]);

  return (
    <PageContainer py="xl">
      <PageBody
        title="Customers"
        description={`Manage customers for ${organizationName}.`}
        action={
          <PermissionGate permission={permissionKey("customers.create")}>
            {formOpen ? (
              <Button
                variant="secondary"
                leftSection={<X size={16} />}
                onClick={() => setFormOpen(false)}
              >
                Close
              </Button>
            ) : (
              <Button leftSection={<Plus size={16} />} onClick={() => setFormOpen(true)}>
                Add customer
              </Button>
            )}
          </PermissionGate>
        }
        toolbar={
          <TextInput
            placeholder="Search customers..."
            aria-label="Search customers"
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
              title="Access denied"
              description="You don't have permission to view customers."
            />
          }
        >
          <Stack gap="md">
            {formOpen ? (
              <Paper withBorder radius="md" p="lg">
                <Title order={3} fz="md" mb="sm">
                  New customer
                </Title>
                <CreateCustomerForm onCancel={() => setFormOpen(false)} />
              </Paper>
            ) : null}

            {filtered.length === 0 ? (
              <EmptyState
                title="No customers yet"
                description="Add your first customer to get started."
              />
            ) : (
              <DataTable data={filtered} columns={columns} />
            )}
          </Stack>
        </PermissionGate>
      </PageBody>
    </PageContainer>
  );
}

export default CustomersPage;
