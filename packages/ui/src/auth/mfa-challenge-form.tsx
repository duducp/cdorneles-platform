"use client";

import { mfaChallengeSchema, type MfaChallengeFormValues } from "@cdorneles/schemas";
import { Box, Button, Stack, Text, TextInput } from "@mantine/core";
import { useForm } from "@mantine/form";
import { KeyRoundIcon } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";

import { FormError } from "../components/form-error";

export interface MfaChallengeFormProps {
  onSubmit: (values: MfaChallengeFormValues) => Promise<void>;
  onResend?: () => Promise<void>;
}

export function MfaChallengeForm({ onSubmit, onResend }: MfaChallengeFormProps) {
  const [status, setStatus] = useState<"idle" | "submitting">("idle");
  const [resending, setResending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const cooldownRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [cooldown, setCooldown] = useState(0);

  useEffect(() => {
    return () => {
      if (cooldownRef.current) clearInterval(cooldownRef.current);
    };
  }, []);

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
    setResending(true);
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
      setError("Erro ao reenviar código. Tente novamente.");
    } finally {
      setResending(false);
    }
  }, [onResend, cooldown]);

  return (
    <Box component="form" onSubmit={form.onSubmit(handleSubmit)} noValidate>
      <FormError mb="md">{error}</FormError>

      <Stack gap={4}>
        <Text component="h1" fw={600} fz="xl">
          Verificação em duas etapas
        </Text>
        <Text c="dimmed" fz="sm">
          Informe o código enviado para você para concluir o acesso.
        </Text>
      </Stack>

      <Stack gap="md" mt="lg">
        <TextInput
          label="Código de verificação"
          placeholder="000000"
          required
          maxLength={6}
          inputMode="numeric"
          pattern="[0-9]*"
          leftSection={<KeyRoundIcon size={16} aria-hidden />}
          aria-label="Código de 6 dígitos"
          aria-invalid={form.errors.code ? true : undefined}
          {...form.getInputProps("code")}
        />

        <Button type="submit" fullWidth loading={status === "submitting"}>
          Verificar código
        </Button>

        {onResend && (
          <Button
            variant="subtle"
            fullWidth
            onClick={handleResend}
            disabled={cooldown > 0}
            loading={resending}
          >
            {cooldown > 0 ? `Reenviar em ${cooldown}s` : "Reenviar código"}
          </Button>
        )}
      </Stack>
    </Box>
  );
}
