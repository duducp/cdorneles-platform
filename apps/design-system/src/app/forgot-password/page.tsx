"use client";

import { useAuth } from "@cdorneles/auth";
import { AuthCard, AuthVisual, ForgotPasswordForm, Logo, ThemeToggle } from "@cdorneles/ui";
import { Anchor, Box, Group, Stack } from "@mantine/core";
import Link from "next/link";
import { useCallback, useState } from "react";

export default function ForgotPasswordPage() {
  const { service } = useAuth();
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = useCallback(
    async (values: { email: string }) => {
      const redirectUrl = `${window.location.origin}/reset-password`;
      await service.requestPasswordRecovery({
        email: values.email,
        redirectUrl,
      });
      setSubmitted(true);
    },
    [service],
  );

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
          <AuthCard
            form={
              submitted ? (
                <div role="status" aria-live="polite">
                  <p>
                    Se o e-mail estiver cadastrado, você receberá um link para redefinir sua senha.
                  </p>
                  <Anchor component={Link} href="/login" underline="always" mt="md" display="block">
                    Voltar para o login
                  </Anchor>
                </div>
              ) : (
                <>
                  <ForgotPasswordForm onSubmit={handleSubmit} />
                  <Anchor component={Link} href="/login" underline="always" mt="md" display="block">
                    Voltar para o login
                  </Anchor>
                </>
              )
            }
            visual={<AuthVisual />}
          />

          <Stack component="footer" align="center" gap="sm">
            <Logo alt="Cdorneles" height={48} />
          </Stack>
        </Stack>
      </Box>
    </Box>
  );
}
