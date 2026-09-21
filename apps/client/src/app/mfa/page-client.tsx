"use client";

import { isApiError } from "@cdorneles/api-client";
import {
  AuthNotConfiguredError,
  describeAuthError,
  resolvePostAuthRedirect,
  useAuth,
  useRedirectIfAuthenticated,
} from "@cdorneles/auth";
import {
  AuthCard,
  AuthVisual,
  FormError,
  MfaChallengeForm,
  AppVersion,
  Logo,
  ThemeToggle,
} from "@cdorneles/ui";
import { Anchor, Flex, Skeleton, Stack, Text } from "@mantine/core";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

export interface MfaPageClientProps {
  /** Product apps send an authenticated visitor to the app. */
  redirectWhenAuthenticated?: boolean;
}

export function MfaPageClient({ redirectWhenAuthenticated = false }: MfaPageClientProps) {
  const { service, completeMfa } = useAuth();
  const router = useRouter();
  const goToApp = useCallback(() => {
    router.replace(resolvePostAuthRedirect(window.location.search));
  }, [router]);
  const canRender = useRedirectIfAuthenticated(redirectWhenAuthenticated, goToApp);
  const [challengeId, setChallengeId] = useState<string | null>(null);
  const [factor, setFactor] = useState<"email" | "totp">("email");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    async function bootstrap() {
      try {
        const factors = await service.listMfaFactors();
        if (cancelled) return;
        const preferred = factors.email ? "email" : factors.totp ? "totp" : null;
        if (!preferred) {
          setError("Nenhum fator MFA disponível.");
          return;
        }
        setFactor(preferred);
        const challenge = await service.createMfaChallenge({ factor: preferred });
        if (cancelled) return;
        setChallengeId(challenge.challengeId);
      } catch (err) {
        if (cancelled) return;
        if (err instanceof AuthNotConfiguredError) {
          setError("Autenticação não configurada neste ambiente.");
        } else if (
          isApiError(err) &&
          (err.status === 401 || err.code === "general_unauthorized_scope")
        ) {
          setError(
            "Sessão não encontrada. Faça login novamente para iniciar a verificação em duas etapas.",
          );
        } else {
          setError("Erro ao iniciar desafio MFA.");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    bootstrap();
    return () => {
      cancelled = true;
    };
  }, [service]);

  const handleSubmit = useCallback(
    async (values: { code: string }) => {
      if (!challengeId) return;
      setError(null);
      try {
        await completeMfa({ challengeId, code: values.code });
        // Carry the redirect the login page forwarded, if any.
        router.push(resolvePostAuthRedirect(window.location.search));
      } catch (err) {
        setError(describeAuthError(err, "Código inválido."));
      }
    },
    [challengeId, completeMfa, router],
  );

  const handleResend = useCallback(
    async () => {
      if (!factor) return;
      try {
        const challenge = await service.createMfaChallenge({ factor });
        setChallengeId(challenge.challengeId);
      } catch {
        setError("Erro ao reenviar código. Tente novamente.");
      }
    },
    [service, factor],
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
              loading && !error ? (
                <Stack gap="md">
                  <Skeleton h={36} />
                  <Skeleton h={36} />
                  <Skeleton h={40} />
                </Stack>
              ) : error ? (
                <Stack gap="md">
                  <Text component="h1" fw={600} fz="xl">
                    Verificação em duas etapas
                  </Text>
                  <FormError>{error}</FormError>
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
              ) : (
                <MfaChallengeForm
                  onSubmit={handleSubmit}
                  onResend={factor === "email" ? handleResend : undefined}
                />
              )
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
