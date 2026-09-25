"use client";

import { permissionKey } from "@cdorneles/permissions";
import { Button, EmptyState, FormError, PageBody, PageContainer, Stack } from "@cdorneles/ui";
import { PermissionGate } from "@cdorneles/ui/permissions";
import { Group, TextInput } from "@mantine/core";
import { useState, type FormEvent } from "react";

function CreateCustomerForm() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [created, setCreated] = useState(false);

  async function submit() {
    if (!name) {
      setError("Preencha ao menos o nome.");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      // The customers API is not wired yet; the form is the console pattern.
      await new Promise((resolve) => setTimeout(resolve, 300));
      setCreated(true);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Não foi possível criar o cliente.");
    } finally {
      setSubmitting(false);
    }
  }

  if (created) {
    return (
      <EmptyState
        title="Cliente criado"
        description={`${name} foi cadastrado com sucesso. Volte à lista para ver os clientes.`}
      />
    );
  }

  return (
    <form
      onSubmit={(event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        void submit();
      }}
      noValidate
      aria-busy={submitting || undefined}
    >
      <Stack gap="md" maw={720}>
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
          <Button type="submit" loading={submitting}>
            Criar cliente
          </Button>
        </Group>
      </Stack>
    </form>
  );
}

export default function Page() {
  return (
    <PageContainer py="xl">
      <PageBody title="Novo cliente" description="Adiciona um cliente à sua organização.">
        <PermissionGate
          permission={permissionKey("customers.create")}
          fallback={
            <EmptyState
              title="Acesso negado"
              description="Você não tem permissão para criar clientes."
            />
          }
        >
          <CreateCustomerForm />
        </PermissionGate>
      </PageBody>
    </PageContainer>
  );
}
