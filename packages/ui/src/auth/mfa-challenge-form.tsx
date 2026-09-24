"use client";

import { mfaChallengeSchema, type MfaChallengeFormValues } from "@cdorneles/schemas";
import { Box, Button, PinInput, Stack, Text } from "@mantine/core";
import { useForm } from "@mantine/form";
import { useCallback, useEffect, useRef, useState } from "react";

import { FormError } from "../components/form-error";

export type { MfaChallengeFormValues };

/** Seconds the resend button stays disabled after a code is sent. */
export const RESEND_COOLDOWN_SECONDS = 30;

export interface MfaChallengeFormProps {
  onSubmit: (values: MfaChallengeFormValues) => Promise<void>;
  onResend?: () => Promise<void>;
}

export function MfaChallengeForm({ onSubmit, onResend }: MfaChallengeFormProps) {
  const [status, setStatus] = useState<"idle" | "submitting">("idle");
  const [resending, setResending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const cooldownRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [cooldown, setCooldown] = useState(onResend ? RESEND_COOLDOWN_SECONDS : 0);

  const startCooldown = useCallback(() => {
    setCooldown(RESEND_COOLDOWN_SECONDS);
    if (cooldownRef.current) clearInterval(cooldownRef.current);
    cooldownRef.current = setInterval(() => {
      setCooldown((prev) => {
        if (prev <= 1) {
          if (cooldownRef.current) clearInterval(cooldownRef.current);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  }, []);

  // The code was just sent when this form appears, so resend starts on cooldown.
  useEffect(() => {
    if (!onResend) return;
    startCooldown();
  }, [onResend, startCooldown]);

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
      startCooldown();
    } catch {
      setError("Erro ao reenviar código. Tente novamente.");
    } finally {
      setResending(false);
    }
  }, [onResend, cooldown, startCooldown]);

  return (
    <Box
      component="form"
      onSubmit={form.onSubmit(handleSubmit)}
      noValidate
      aria-busy={status === "submitting" || undefined}
    >
      <FormError id="mfa-form-error" mb="md">
        {error}
      </FormError>

      <Stack gap={4}>
        <Text component="h1" fw={600} fz="xl">
          Verificação em duas etapas
        </Text>
        <Text c="dimmed" fz="sm">
          Informe o código enviado para você para concluir o acesso.
        </Text>
      </Stack>

      <Stack gap="md" mt="lg">
        <Box>
          <Text fw={500} size="sm" mb="xs">
            Código de verificação
          </Text>
          <PinInput
            length={6}
            type="number"
            placeholder=""
            value={form.values.code}
            onChange={(value) => form.setFieldValue("code", value)}
            onComplete={() => {
              if (status === "submitting") return;
              void form.onSubmit(handleSubmit)();
            }}
            error={Boolean(form.errors.code)}
            getInputProps={(index) => ({
              "aria-label": `Código de verificação, dígito ${index + 1} de 6`,
              ...(form.errors.code ? { "aria-describedby": "mfa-code-error" } : {}),
            })}
          />
          {form.errors.code && (
            <Text c="red" size="sm" id="mfa-code-error" mt={5}>
              {form.errors.code}
            </Text>
          )}
        </Box>

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
