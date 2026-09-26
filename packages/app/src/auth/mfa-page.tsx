"use client";

import { isApiError, isUnauthorized } from "@cdorneles/api-client";
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
  Button,
  FormError,
  MfaChallengeForm,
  AppVersion,
  Logo,
  ThemeToggle,
} from "@cdorneles/ui";
import { Flex, Skeleton, Stack, Text } from "@mantine/core";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

export interface MfaPageProps {
  /** Send an already-authenticated visitor to the app. Defaults to on. */
  redirectWhenAuthenticated?: boolean;
}

export function MfaPage({ redirectWhenAuthenticated = true }: MfaPageProps) {
  const { service, completeMfa, logout } = useAuth();
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
        } else if (isApiError(err) && isUnauthorized(err)) {
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

  // Page-level `error` is reserved for bootstrap failures, which replace the
  // form entirely. Submit/resend failures must rethrow so MfaChallengeForm
  // shows them inline while keeping the pin input on screen.
  const handleSubmit = useCallback(
    async (values: { code: string }) => {
      if (!challengeId) return;
      try {
        await completeMfa({ challengeId, code: values.code });
        // Carry the redirect the login page forwarded, if any.
        router.push(resolvePostAuthRedirect(window.location.search));
      } catch (err) {
        throw new Error(describeAuthError(err, "Código inválido."), { cause: err });
      }
    },
    [challengeId, completeMfa, router],
  );

  const handleResend = useCallback(async () => {
    if (!factor) return;
    try {
      const challenge = await service.createMfaChallenge({ factor });
      setChallengeId(challenge.challengeId);
    } catch {
      throw new Error("Erro ao reenviar código. Tente novamente.");
    }
  }, [service, factor]);

  const handleCancel = useCallback(() => {
    void logout()
      .catch(() => undefined)
      .finally(() => {
        window.location.href = "/login";
      });
  }, [logout]);

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
              loading && !error ? (
                <Stack gap="md">
                  <Skeleton h={36} />
                  <Skeleton h={36} />
                  <Skeleton h={40} />
                </Stack>
              ) : error ? (
                <Stack gap="md">
                  <FormError>{error}</FormError>
                  <Text component="h1" fw={600} fz="xl">
                    Verificação em duas etapas
                  </Text>
                  <Button type="button" variant="subtle" fullWidth onClick={handleCancel}>
                    Cancelar
                  </Button>
                </Stack>
              ) : (
                <MfaChallengeForm
                  onSubmit={handleSubmit}
                  onResend={factor === "email" ? handleResend : undefined}
                  onCancel={handleCancel}
                />
              )
            }
            visual={<AuthVisual />}
          />

          <Stack component="footer" align="center" gap="sm">
            <Logo alt="Carlos Dorneles" variant="horizontal" height={32} />
            <AppVersion />
          </Stack>
        </Stack>
      </Flex>
    </Flex>
  );
}
