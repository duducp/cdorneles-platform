"use client";

import { isApiError } from "@cdorneles/api-client";
import { AuthNotConfiguredError, useAuth } from "@cdorneles/auth";
import { AuthCard, AuthVisual, LoginForm, Logo, ThemeToggle } from "@cdorneles/ui";
import { Anchor, Box, Group, Stack, Text } from "@mantine/core";
import { useRouter } from "next/navigation";
import { useState } from "react";

export default function LoginPage() {
  const { login } = useAuth();
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const enableSignUp = process.env.NEXT_PUBLIC_ENABLE_SIGN_UP === "true";

  async function handleSubmit(credentials: { email: string; password: string }) {
    setError(null);
    setLoading(true);
    try {
      await login(credentials);
      router.push("/");
    } catch (err) {
      if (err instanceof AuthNotConfiguredError) {
        setError("Autenticação não configurada neste ambiente.");
      } else if (isApiError(err) && err.code === "user_invalid_credentials") {
        setError("E-mail ou senha inválidos.");
      } else {
        setError("Não foi possível entrar. Tente novamente.");
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <Box style={{ display: "flex", flexDirection: "column", minHeight: "100dvh" }}>
      <Group justify="flex-end" p="md">
        <ThemeToggle />
      </Group>

      <Stack style={{ flex: 1 }} align="center" justify="center" gap="xl" p="md">
        <AuthCard
          form={
            <LoginForm
              onSubmit={handleSubmit}
              loading={loading}
              error={error}
              showSignUp={enableSignUp}
            />
          }
          visual={<AuthVisual />}
        />

        <Stack align="center" gap="sm">
          <Text ta="center" fz="xs" c="dimmed">
            Ao continuar, você concorda com os <Anchor href="#">Termos de Uso</Anchor> e a{" "}
            <Anchor href="#">Política de Privacidade</Anchor>.
          </Text>
          <Logo alt="Cdorneles" height={48} />
        </Stack>
      </Stack>
    </Box>
  );
}
