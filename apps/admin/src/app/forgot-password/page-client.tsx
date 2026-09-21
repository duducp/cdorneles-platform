"use client";

import { useAuth, useRedirectIfAuthenticated } from "@cdorneles/auth";
import { AppVersion, AuthCard, AuthVisual, ForgotPasswordForm, Logo, ThemeToggle } from "@cdorneles/ui";
import { Anchor, Flex, Stack } from "@mantine/core";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback } from "react";

export interface ForgotPasswordPageClientProps {
  /** Product apps send an authenticated visitor to the app. */
  redirectWhenAuthenticated?: boolean;
}

export function ForgotPasswordPageClient({
  redirectWhenAuthenticated = false,
}: ForgotPasswordPageClientProps) {
  const { service } = useAuth();
  const router = useRouter();
  const goToApp = useCallback(() => router.replace("/"), [router]);
  const canRender = useRedirectIfAuthenticated(redirectWhenAuthenticated, goToApp);

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
          <AuthCard
            form={
              <Stack gap="md">
                <ForgotPasswordForm onSubmit={handleSubmit} />
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

          <Stack component="footer" align="center" gap="sm">
            <Logo alt="Cdorneles" variant="horizontal" height={32} />
            <AppVersion />
          </Stack>
        </Stack>
      </Flex>
    </Flex>
  );
}
