import { forgotPasswordSchema, type ForgotPasswordFormValues } from "@cdorneles/schemas";
import { Button, TextInput } from "@mantine/core";
import { useForm } from "@mantine/form";
import { MailIcon } from "lucide-react";
import { useCallback, useState } from "react";

export interface ForgotPasswordFormProps {
  onSubmit: (values: ForgotPasswordFormValues) => Promise<void>;
}

export function ForgotPasswordForm({ onSubmit }: ForgotPasswordFormProps) {
  const [status, setStatus] = useState<"idle" | "submitting" | "sent">("idle");
  const [error, setError] = useState<string | null>(null);

  const form = useForm<ForgotPasswordFormValues>({
    initialValues: { email: "" },
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
        <p>
          Se o e-mail <strong>{form.values.email}</strong> estiver cadastrado, você receberá um link
          para redefinir sua senha.
        </p>
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

      <TextInput
        label="E-mail"
        placeholder="voce@exemplo.com"
        required
        leftSection={<MailIcon size={16} aria-hidden />}
        {...form.getInputProps("email")}
      />

      <Button type="submit" fullWidth mt="md" loading={status === "submitting"}>
        Enviar link de recuperação
      </Button>
    </form>
  );
}
