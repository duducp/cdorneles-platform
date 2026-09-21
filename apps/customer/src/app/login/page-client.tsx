"use client";

import { isApiError } from "@cdorneles/api-client";
import {
  AuthNotConfiguredError,
  MfaRequiredError,
  resolvePostAuthRedirect,
  useAuth,
} from "@cdorneles/auth";
import { AuthCard, AuthVisual, LoginForm, Logo, ThemeToggle } from "@cdorneles/ui";
import { Anchor, Flex, Stack, Text, VisuallyHidden } from "@mantine/core";
import { useRouter } from "next/navigation";
import { useState } from "react";

export function LoginPageClient() {
  const { login } = useAuth();
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [announcement, setAnnouncement] = useState("");
  const enableSignUp = process.env.NEXT_PUBLIC_ENABLE_SIGN_UP === "true";

  async function handleSubmit(credentials: { email: string; password: string }) {
    setError(null);
    setAnnouncement("Entrando...");
    setLoading(true);
    try {
      await login(credentials);
      // Honour the path the middleware sent the user away from.
      router.push(resolvePostAuthRedirect(window.location.search));
    } catch (err) {
      setAnnouncement("");
      if (err instanceof AuthNotConfiguredError) {
        setError("Autenticação não configurada neste ambiente.");
      } else if (err instanceof MfaRequiredError) {
        router.push(
          `/mfa?redirect=${encodeURIComponent(resolvePostAuthRedirect(window.location.search))}`,
        );
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
        <VisuallyHidden aria-live="polite">{announcement}</VisuallyHidden>
        <Stack w="100%" maw={920} gap="xl">
          <AuthCard
            form={
              <LoginForm
                onSubmit={handleSubmit}
                loading={loading}
                error={error}
                showSignUp={enableSignUp}
                onForgotPassword={() => router.push("/forgot-password")}
              />
            }
            visual={<AuthVisual />}
          />

          <Stack component="footer" align="center" gap="sm">
            <Text ta="center" fz="xs" c="dimmed">
              Ao continuar, você concorda com os{" "}
              <Anchor href="#" underline="always">
                Termos de Uso
              </Anchor>{" "}
              e a{" "}
              <Anchor href="#" underline="always">
                Política de Privacidade
              </Anchor>
              .
            </Text>
            <Logo alt="Cdorneles" variant="horizontal" height={32} />
          </Stack>
        </Stack>
      </Flex>
    </Flex>
  );
}
