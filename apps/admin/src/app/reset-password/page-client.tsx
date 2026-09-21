"use client";

import { useAuth, useRedirectIfAuthenticated } from "@cdorneles/auth";
import {
  AuthCard,
  AuthVisual,
  FormError,
  ResetPasswordForm,
  Logo,
  ThemeToggle,
} from "@cdorneles/ui";
import { Anchor, Flex, Stack } from "@mantine/core";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useCallback } from "react";

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
      <Stack gap="md">
        <FormError>Link de recuperação inválido. Solicite um novo link.</FormError>
        <Anchor
          component={Link}
          href="/forgot-password"
          underline="always"
          display="block"
          ta="center"
        >
          Solicitar novo link
        </Anchor>
      </Stack>
    );
  }

  return (
    <Stack gap="md">
      <ResetPasswordForm onSubmit={handleSubmit} />
      <Anchor
        component={Link}
        href="/login"
        underline="always"
        display="block"
        ta="center"
      >
        Voltar para o login
      </Anchor>
    </Stack>
  );
}

export interface ResetPasswordPageClientProps {
  /** Product apps send an authenticated visitor to the app. */
  redirectWhenAuthenticated?: boolean;
}

export function ResetPasswordPageClient({
  redirectWhenAuthenticated = false,
}: ResetPasswordPageClientProps) {
  const router = useRouter();
  const goToApp = useCallback(() => router.replace("/"), [router]);
  const canRender = useRedirectIfAuthenticated(redirectWhenAuthenticated, goToApp);

  if (!canRender) {
    return null;
  }

  return (
    <Flex direction="column" mih="100dvh">
      <Flex justify="flex-end" p="sm">
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
            <Logo alt="Cdorneles" variant="horizontal" height={32} />
          </Stack>
        </Stack>
      </Flex>
    </Flex>
  );
}
