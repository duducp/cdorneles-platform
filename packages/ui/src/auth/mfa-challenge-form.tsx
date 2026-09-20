"use client";

import { mfaChallengeSchema, type MfaChallengeFormValues } from "@cdorneles/schemas";
import { Button, TextInput } from "@mantine/core";
import { useForm } from "@mantine/form";
import { KeyRoundIcon } from "lucide-react";
import { useCallback, useRef, useState } from "react";

export interface MfaChallengeFormProps {
  onSubmit: (values: MfaChallengeFormValues) => Promise<void>;
  onResend?: () => Promise<void>;
}

export function MfaChallengeForm({ onSubmit, onResend }: MfaChallengeFormProps) {
  const [status, setStatus] = useState<"idle" | "submitting" | "sent">("idle");
  const [error, setError] = useState<string | null>(null);
  const cooldownRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [cooldown, setCooldown] = useState(0);

  const form = useForm<MfaChallengeFormValues>({
    initialValues: { code: "" },
    validate: (values) => {
      const result = mfaChallengeSchema.safeParse(values);
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
    async (values: MfaChallengeFormValues) => {
      setStatus("submitting");
      setError(null);
      try {
        await onSubmit(values);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Código inválido.");
        setStatus("idle");
      }
    },
    [onSubmit],
  );

  const handleResend = useCallback(async () => {
    if (!onResend || cooldown > 0) return;
    try {
      await onResend();
      setCooldown(30);
      cooldownRef.current = setInterval(() => {
        setCooldown((prev) => {
          if (prev <= 1) {
            if (cooldownRef.current) clearInterval(cooldownRef.current);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    } catch {
      /* resend errors are non-critical */
    }
  }, [onResend, cooldown]);

  return (
    <form onSubmit={form.onSubmit(handleSubmit)} noValidate>
      {error && (
        <div role="alert" style={{ marginBottom: 16 }}>
          <p style={{ color: "var(--mantine-color-red-6)" }}>{error}</p>
        </div>
      )}

      <TextInput
        label="Código de verificação"
        placeholder="000000"
        required
        maxLength={6}
        inputMode="numeric"
        pattern="[0-9]*"
        leftSection={<KeyRoundIcon size={16} aria-hidden />}
        aria-label="Código de 6 dígitos"
        {...form.getInputProps("code")}
      />

      <Button type="submit" fullWidth mt="md" loading={status === "submitting"}>
        Verificar código
      </Button>

      {onResend && (
        <Button
          variant="subtle"
          fullWidth
          mt="sm"
          onClick={handleResend}
          disabled={cooldown > 0}
          loading={status === "submitting"}
        >
          {cooldown > 0 ? `Reenviar em ${cooldown}s` : "Reenviar código"}
        </Button>
      )}
    </form>
  );
}
