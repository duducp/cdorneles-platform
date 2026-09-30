"use client";

import { useAuth, useRedirectIfAuthenticated } from "@cdorneles/auth";
import {
  AuthCard,
  AuthFooter,
  AuthVisual,
  ForgotPasswordForm,
  ThemeToggle,
  Turnstile,
  useTurnstile,
} from "@cdorneles/ui";
import { Anchor, Flex, Stack } from "@mantine/core";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback } from "react";

export interface ForgotPasswordPageProps {
  /** Send an already-authenticated visitor to the app. Defaults to on. */
  redirectWhenAuthenticated?: boolean;
  /** Pre-fills the e-mail, e.g. the one typed on the login screen. */
  initialEmail?: string;
}

export function ForgotPasswordPage({
  redirectWhenAuthenticated = true,
  initialEmail,
}: ForgotPasswordPageProps) {
  const { service } = useAuth();
  const router = useRouter();
  const turnstile = useTurnstile();
  const goToApp = useCallback(() => router.replace("/"), [router]);
  const canRender = useRedirectIfAuthenticated(redirectWhenAuthenticated, goToApp);

  const handleSubmit = useCallback(
    async (values: { email: string }) => {
      const redirectUrl = `${window.location.origin}/reset-password`;
      const turnstileToken = await turnstile.nextToken();
      await service.requestPasswordRecovery({
        email: values.email,
        redirectUrl,
        turnstileToken,
      });
    },
    [service, turnstile],
  );

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
          <AuthCard
            form={
              <Stack gap="md">
                <ForgotPasswordForm
                  onSubmit={handleSubmit}
                  initialEmail={initialEmail}
                  captchaSlot={<Turnstile ref={turnstile.handleRef} />}
                />
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
            }
            visual={<AuthVisual />}
          />

          <AuthFooter />
        </Stack>
      </Flex>
    </Flex>
  );
}
