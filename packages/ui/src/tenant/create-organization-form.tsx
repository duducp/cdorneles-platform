"use client";

import { organizationNameSchema } from "@cdorneles/schemas";
import { Button, Stack, TextInput } from "@mantine/core";
import { useForm } from "@mantine/form";
import { useState } from "react";

import { FormError } from "../components/form-error";

export interface CreateOrganizationFormProps {
  onCreate: (name: string) => Promise<void>;
  onCancel?: () => void;
}

export function CreateOrganizationForm({ onCreate, onCancel }: CreateOrganizationFormProps) {
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const form = useForm({
    initialValues: { name: "" },
    validate: (values) => {
      const result = organizationNameSchema.safeParse(values.name);
      return result.success ? {} : { name: result.error.issues[0]?.message ?? "Invalid name" };
    },
  });

  async function handleSubmit(values: { name: string }) {
    setError(null);
    setSubmitting(true);
    try {
      await onCreate(values.name.trim());
      form.reset();
    } catch (submitError) {
      setError(
        submitError instanceof Error ? submitError.message : "Não foi possível criar a organização.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  const submit = form.onSubmit(handleSubmit, () => {
    form.getInputNode("name")?.focus();
  });

  return (
    <form onSubmit={submit} noValidate aria-busy={submitting || undefined}>
      <Stack gap="md">
        <FormError>{error}</FormError>
        <TextInput
          label="Nome da organização"
          placeholder="Acme Ltda"
          required
          data-autofocus
          {...form.getInputProps("name")}
        />
        <Stack gap="xs">
          <Button type="submit" loading={submitting} fullWidth>
            Criar organização
          </Button>
          {onCancel && (
            <Button variant="subtle" onClick={onCancel} disabled={submitting} fullWidth>
              Cancel
            </Button>
          )}
        </Stack>
      </Stack>
    </form>
  );
}
