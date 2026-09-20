"use client";

import { useAuth } from "@cdorneles/auth";
import { AuthCard, AuthVisual, ForgotPasswordForm, Logo, ThemeToggle } from "@cdorneles/ui";
import { Anchor, Flex, Stack } from "@mantine/core";
import Link from "next/link";
import { useCallback } from "react";

export default function ForgotPasswordPage() {
  const { service } = useAuth();

  const handleSubmit = useCallback(
    async (values: { email: string }) => {
      const redirectUrl = `${window.location.origin}/reset-password`;
      await service.requestPasswordRecovery({
        email: values.email,
        redirectUrl,
      });
    },
    [service],
  );

  return (
    <Flex direction="column" mih="100dvh">
      <Flex justify="flex-end" p="md">
        <ThemeToggle />
      </Flex>

      <Flex
        component="main"
        align="center"
        justify="center"
        p="md"
        style={{ flex: 1 }}
      >
        <Stack w="100%" maw={920} gap="xl">
          <AuthCard
            form={
              <>
                <ForgotPasswordForm onSubmit={handleSubmit} />
                <Anchor component={Link} href="/login" underline="always" mt="md" display="block">
                  Voltar para o login
                </Anchor>
              </>
            }
            visual={<AuthVisual />}
          />

          <Stack component="footer" align="center" gap="sm">
            <Logo alt="Cdorneles" height={48} />
          </Stack>
        </Stack>
      </Flex>
    </Flex>
  );
}
