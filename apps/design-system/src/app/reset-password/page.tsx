"use client";

import { useAuth } from "@cdorneles/auth";
import { AuthCard, AuthVisual, ResetPasswordForm, Logo, ThemeToggle } from "@cdorneles/ui";
import { Anchor, Flex, Stack, Text } from "@mantine/core";
import Link from "next/link";
import { Suspense, useCallback } from "react";
import { useSearchParams } from "next/navigation";

function ResetPasswordContent() {
  const { service } = useAuth();
  const searchParams = useSearchParams();
  const userId = searchParams.get("userId");
  const secret = searchParams.get("secret");

  const handleSubmit = useCallback(
    async (values: { password: string; passwordConfirmation: string }) => {
      if (!userId || !secret) return;
      await service.confirmPasswordRecovery({
        userId,
        secret,
        password: values.password,
      });
    },
    [service, userId, secret],
  );

  if (!userId || !secret) {
    return (
      <div role="alert">
        <Text>Link de recuperação inválido. Solicite um novo link.</Text>
        <Anchor component={Link} href="/forgot-password" underline="always" mt="md" display="block">
          Solicitar novo link
        </Anchor>
      </div>
    );
  }

  return (
    <>
      <ResetPasswordForm onSubmit={handleSubmit} />
      <Anchor component={Link} href="/login" underline="always" mt="md" display="block">
        Voltar para o login
      </Anchor>
    </>
  );
}

export default function ResetPasswordPage() {
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
      </Flex>
    </Flex>
  );
}
