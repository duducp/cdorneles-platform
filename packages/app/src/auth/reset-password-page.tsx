"use client";

import { useAuth, useRedirectIfAuthenticated } from "@cdorneles/auth";
import {
  AuthCard,
  AuthFooter,
  AuthVisual,
  FormError,
  ResetPasswordForm,
  ThemeToggle,
  Turnstile,
  useTurnstile,
} from "@cdorneles/ui";
import { Anchor, Flex, Stack } from "@mantine/core";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useCallback } from "react";

function ResetPasswordContent() {
  const { service } = useAuth();
  const searchParams = useSearchParams();
  const turnstile = useTurnstile();
  const userId = searchParams.get("userId");
  const secret = searchParams.get("secret");

  const handleSubmit = useCallback(
    async (values: { password: string; passwordConfirmation: string }) => {
      if (!userId || !secret) return;
      const turnstileToken = await turnstile.nextToken();
      await service.confirmPasswordRecovery({
        userId,
        secret,
        password: values.password,
        turnstileToken,
      });
    },
    [service, userId, secret, turnstile],
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
      <ResetPasswordForm
        onSubmit={handleSubmit}
        captchaSlot={<Turnstile ref={turnstile.handleRef} />}
      />
      <Anchor component={Link} href="/login" underline="always" display="block" ta="center">
        Voltar para o login
      </Anchor>
    </Stack>
  );
}

export interface ResetPasswordPageProps {
  /** Send an already-authenticated visitor to the app. Defaults to on. */
  redirectWhenAuthenticated?: boolean;
}

export function ResetPasswordPage({ redirectWhenAuthenticated = true }: ResetPasswordPageProps) {
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

      <Flex component="main" align="center" justify="center" p="md" style={{ flex: 1 }}>
        <Stack w="100%" maw={920} gap="xl">
          <Suspense>
            <AuthCard form={<ResetPasswordContent />} visual={<AuthVisual />} />
          </Suspense>

          <AuthFooter />
        </Stack>
      </Flex>
    </Flex>
  );
}
