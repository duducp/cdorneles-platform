"use client";

import { forgotPasswordSchema, type ForgotPasswordFormValues } from "@cdorneles/schemas";
import { Box, Button, Stack, Text, TextInput } from "@mantine/core";
import { useForm } from "@mantine/form";
import { MailIcon } from "lucide-react";
import { useCallback, useState } from "react";

import { FormError } from "../components/form-error";

export interface ForgotPasswordFormProps {
  onSubmit: (values: ForgotPasswordFormValues) => Promise<void>;
  /** Pre-fills the e-mail, e.g. the one typed on the login screen. */
  initialEmail?: string;
}

export function ForgotPasswordForm({ onSubmit, initialEmail = "" }: ForgotPasswordFormProps) {
  const [status, setStatus] = useState<"idle" | "submitting" | "sent">("idle");
  const [error, setError] = useState<string | null>(null);

  const form = useForm<ForgotPasswordFormValues>({
    initialValues: { email: initialEmail },
    validate: (values) => {
      const result = forgotPasswordSchema.safeParse(values);
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
    async (values: ForgotPasswordFormValues) => {
      setStatus("submitting");
      setError(null);
      try {
        await onSubmit(values);
        setStatus("sent");
      } catch (err) {
        setError(err instanceof Error ? err.message : "Erro ao enviar e-mail de recuperação.");
        setStatus("idle");
      }
    },
    [onSubmit],
  );

  if (status === "sent") {
    return (
      <div role="status" aria-live="polite">
        <Text>
          Se o e-mail <strong>{form.values.email}</strong> estiver cadastrado, você receberá um link
          para redefinir sua senha.
        </Text>
      </div>
    );
  }

  return (
    <Box
      component="form"
      onSubmit={form.onSubmit(handleSubmit)}
      noValidate
      aria-busy={status === "submitting" || undefined}
    >
      <FormError id="forgot-password-form-error" mb="md">{error}</FormError>

      <Stack gap={4}>
        <Text component="h1" fw={600} fz="xl">
          Esqueceu sua senha?
        </Text>
        <Text c="dimmed" fz="sm">
          Informe seu e-mail para receber um link de recuperação.
        </Text>
      </Stack>

      <Stack gap="md" mt="lg">
        <TextInput
          label="E-mail"
          placeholder="voce@exemplo.com"
          type="email"
          inputMode="email"
          autoComplete="email"
          required
          leftSection={<MailIcon size={16} aria-hidden />}
          aria-invalid={form.errors.email ? true : undefined}
          aria-describedby={form.errors.email ? "forgot-password-form-error" : undefined}
          {...form.getInputProps("email")}
        />

        <Button type="submit" fullWidth loading={status === "submitting"}>
          Enviar link de recuperação
        </Button>
      </Stack>
    </Box>
  );
}
