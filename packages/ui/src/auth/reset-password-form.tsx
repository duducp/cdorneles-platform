"use client";

import { resetPasswordSchema, type ResetPasswordFormValues } from "@cdorneles/schemas";
import { Box, Button, PasswordInput, Stack, Text } from "@mantine/core";
import { useForm } from "@mantine/form";
import { LockIcon } from "lucide-react";
import { useCallback, useState } from "react";

import { FormError } from "../components/form-error";

export interface ResetPasswordFormProps {
  onSubmit: (values: ResetPasswordFormValues) => Promise<void>;
}

export function ResetPasswordForm({ onSubmit }: ResetPasswordFormProps) {
  const [status, setStatus] = useState<"idle" | "submitting" | "done">("idle");
  const [error, setError] = useState<string | null>(null);

  const form = useForm<ResetPasswordFormValues>({
    initialValues: { password: "", passwordConfirmation: "" },
    validate: (values) => {
      const result = resetPasswordSchema.safeParse(values);
      if (result.success) return {};
      const fieldErrors: Record<string, string> = {};
      for (const issue of result.error.issues) {
        const path = issue.path.join(".");
        if (path && !fieldErrors[path]) {
          fieldErrors[path] = issue.message;
        }
      }
      return fieldErrors;
    },
  });

  const handleSubmit = useCallback(
    async (values: ResetPasswordFormValues) => {
      setStatus("submitting");
      setError(null);
      try {
        await onSubmit(values);
        setStatus("done");
      } catch (err) {
        setError(err instanceof Error ? err.message : "Erro ao redefinir senha.");
        setStatus("idle");
      }
    },
    [onSubmit],
  );

  const submit = form.onSubmit(handleSubmit, (errors) => {
    const first = (["password", "passwordConfirmation"] as const).find(
      (field) => errors[field] !== undefined,
    );
    if (first) form.getInputNode(first)?.focus();
  });

  if (status === "done") {
    return (
      <div role="status" aria-live="polite">
        <Text>Senha redefinida com sucesso. Você já pode fazer login.</Text>
      </div>
    );
  }

  return (
    <Box
      component="form"
      onSubmit={submit}
      noValidate
      aria-busy={status === "submitting" || undefined}
      aria-describedby={error ? "reset-password-form-error" : undefined}
    >
      <FormError id="reset-password-form-error" mb="md">
        {error}
      </FormError>

      <Stack gap={4}>
        <Text component="h1" fw={600} fz="xl">
          Redefinir senha
        </Text>
        <Text c="dimmed" fz="sm">
          Crie uma nova senha para sua conta.
        </Text>
      </Stack>

      <Stack gap="md" mt="lg">
        <PasswordInput
          label="Nova senha"
          placeholder="Mínimo 8 caracteres"
          required
          autoComplete="new-password"
          leftSection={<LockIcon size={16} aria-hidden />}
          visibilityToggleFocusable
          visibilityToggleButtonProps={{ "aria-label": "Alternar visibilidade da senha" }}
          {...form.getInputProps("password")}
        />

        <PasswordInput
          label="Confirmar nova senha"
          placeholder="Repita a nova senha"
          required
          autoComplete="new-password"
          leftSection={<LockIcon size={16} aria-hidden />}
          visibilityToggleFocusable
          visibilityToggleButtonProps={{
            "aria-label": "Alternar visibilidade da confirmação de senha",
          }}
          {...form.getInputProps("passwordConfirmation")}
        />

        <Button type="submit" fullWidth loading={status === "submitting"}>
          Redefinir senha
        </Button>
      </Stack>
    </Box>
  );
}
