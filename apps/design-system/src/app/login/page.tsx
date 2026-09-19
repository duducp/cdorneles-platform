"use client";

import { isApiError } from "@cdorneles/api-client";
import { AuthNotConfiguredError, useAuth } from "@cdorneles/auth";
import { AuthCard, AuthVisual, LoginForm, ThemeToggle } from "@cdorneles/ui";
import { Anchor, Box, Group, Text } from "@mantine/core";
import { useRouter } from "next/navigation";
import { useState } from "react";

export default function LoginPage() {
  const { login } = useAuth();
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

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

      <Box
        style={{
          flex: 1,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: "var(--mantine-spacing-md)",
        }}
      >
        <AuthCard
          form={<LoginForm onSubmit={handleSubmit} loading={loading} error={error} />}
          visual={<AuthVisual />}
        />
      </Box>

      <Text ta="center" fz="xs" c="dimmed" p="lg">
        Ao continuar, você concorda com os <Anchor href="#">Termos de Uso</Anchor> e a{" "}
        <Anchor href="#">Política de Privacidade</Anchor>.
      </Text>
    </Box>
  );
}
