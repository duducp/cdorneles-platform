"use client";

import { resetPasswordSchema, type ResetPasswordFormValues } from "@cdorneles/schemas";
import { Button, PasswordInput } from "@mantine/core";
import { useForm } from "@mantine/form";
import { LockIcon } from "lucide-react";
import { useCallback, useState } from "react";

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

  if (status === "done") {
    return (
      <div role="status" aria-live="polite">
        <p>Senha redefinida com sucesso. Você já pode fazer login.</p>
      </div>
    );
  }

  return (
    <form onSubmit={form.onSubmit(handleSubmit)} noValidate>
      {error && (
        <div role="alert" style={{ marginBottom: 16 }}>
          <p style={{ color: "var(--mantine-color-red-6)" }}>{error}</p>
        </div>
      )}

      <PasswordInput
        label="Nova senha"
        placeholder="Mínimo 8 caracteres"
        required
        leftSection={<LockIcon size={16} aria-hidden />}
        {...form.getInputProps("password")}
      />

      <PasswordInput
        label="Confirmar nova senha"
        placeholder="Repita a nova senha"
        required
        leftSection={<LockIcon size={16} aria-hidden />}
        {...form.getInputProps("passwordConfirmation")}
      />

      <Button type="submit" fullWidth mt="md" loading={status === "submitting"}>
        Redefinir senha
      </Button>
    </form>
  );
}
