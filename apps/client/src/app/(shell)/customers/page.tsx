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
      setError(cause instanceof Error ? cause.message : "Não foi possível criar o cliente.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} aria-busy={submitting || undefined} noValidate>
      <Stack gap="md" maw={560}>
        <FormError>{error}</FormError>
        <TextInput
          label="Nome"
          value={name}
          onChange={(event) => setName(event.currentTarget.value)}
        />
        <TextInput
          label="E-mail"
          type="email"
          value={email}
          onChange={(event) => setEmail(event.currentTarget.value)}
        />
        <TextInput
          label="Telefone"
          value={phone}
          onChange={(event) => setPhone(event.currentTarget.value)}
        />
        <Group justify="flex-end">
          <Button variant="subtle" type="button" onClick={onCancel} disabled={submitting}>
            Cancelar
          </Button>
          <Button type="submit" loading={submitting}>
            Criar cliente
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
        title="Clientes"
        description={`Gerencie os clientes de ${organizationName}.`}
        action={
          <PermissionGate permission={permissionKey("customers.create")}>
            {formOpen ? (
              <Button
                variant="secondary"
                leftSection={<X size={16} />}
                onClick={() => setFormOpen(false)}
              >
                Fechar
              </Button>
            ) : (
              <Button leftSection={<Plus size={16} />} onClick={() => setFormOpen(true)}>
                Novo cliente
              </Button>
            )}
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
          <Stack gap="md">
            {formOpen ? (
              <Paper radius="md" p="lg">
                <Title order={3} fz="md" mb="sm">
                  Novo cliente
                </Title>
                <CreateCustomerForm onCancel={() => setFormOpen(false)} />
              </Paper>
            ) : null}

            {filtered.length === 0 ? (
              <EmptyState
                title="Nenhum cliente ainda"
                description="Adicione o primeiro cliente para começar."
              />
            ) : (
              <DataTable data={filtered} columns={columns} withBorder={false} />
            )}
          </Stack>
        </PermissionGate>
      </PageBody>
    </PageContainer>
  );
}

export default CustomersPage;
