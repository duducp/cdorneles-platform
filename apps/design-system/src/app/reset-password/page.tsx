"use client";

import { useAuth } from "@cdorneles/auth";
import { AuthCard, AuthVisual, ResetPasswordForm, Logo, ThemeToggle } from "@cdorneles/ui";
import { Anchor, Box, Group, Stack } from "@mantine/core";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useCallback, useState } from "react";

function ResetPasswordContent() {
  const { service } = useAuth();
  const searchParams = useSearchParams();
  const userId = searchParams.get("userId");
  const secret = searchParams.get("secret");
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = useCallback(
    async (values: { password: string; passwordConfirmation: string }) => {
      if (!userId || !secret) {
        setError("Link de recuperação inválido.");
        return;
      }
      setError(null);
      await service.confirmPasswordRecovery({
        userId,
        secret,
        password: values.password,
      });
      setDone(true);
    },
    [service, userId, secret],
  );

  if (!userId || !secret) {
    return (
      <div role="alert">
        <p>Link de recuperação inválido. Solicite um novo link.</p>
        <Anchor component={Link} href="/forgot-password" underline="always" mt="md" display="block">
          Solicitar novo link
        </Anchor>
      </div>
    );
  }

  if (done) {
    return (
      <div role="status" aria-live="polite">
        <p>Senha redefinida com sucesso. Você já pode fazer login.</p>
        <Anchor component={Link} href="/login" underline="always" mt="md" display="block">
          Ir para o login
        </Anchor>
      </div>
    );
  }

  return (
    <>
      {error && (
        <div role="alert" style={{ marginBottom: 16 }}>
          <p style={{ color: "var(--mantine-color-red-6)" }}>{error}</p>
        </div>
      )}
      <ResetPasswordForm onSubmit={handleSubmit} />
      <Anchor component={Link} href="/login" underline="always" mt="md" display="block">
        Voltar para o login
      </Anchor>
    </>
  );
}

export default function ResetPasswordPage() {
  return (
    <Box style={{ display: "flex", flexDirection: "column", minHeight: "100dvh" }}>
      <Group justify="flex-end" p="md">
        <ThemeToggle />
      </Group>

      <Box
        component="main"
        style={{
          flex: 1,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: "var(--mantine-spacing-md)",
        }}
      >
        <Stack w="100%" maw={920} gap="xl">
          <Suspense>
            <AuthCard
              form={<ResetPasswordContent />}
              visual={<AuthVisual />}
            />
          </Suspense>

          <Stack component="footer" align="center" gap="sm">
            <Logo alt="Cdorneles" height={48} />
          </Stack>
        </Stack>
      </Box>
    </Box>
  );
}
