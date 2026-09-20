"use client";

import { isApiError } from "@cdorneles/api-client";
import { AuthNotConfiguredError, useAuth } from "@cdorneles/auth";
import { AuthCard, AuthVisual, MfaChallengeForm, Logo, ThemeToggle } from "@cdorneles/ui";
import { Anchor, Flex, Skeleton, Stack, Text } from "@mantine/core";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

export default function MfaPage() {
  const { service, completeMfa } = useAuth();
  const router = useRouter();
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
        router.push("/");
      } catch (err) {
        setError(err instanceof Error ? err.message : "Código inválido.");
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
      setError("Erro ao reenviar código. Tente novamente.");
    }
  }, [service, factor]);

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
              loading && !error ? (
                <Stack gap="md">
                  <Skeleton h={36} />
                  <Skeleton h={36} />
                  <Skeleton h={40} />
                </Stack>
              ) : error ? (
                <div role="alert">
                  <Stack gap={4}>
                    <Text component="h1" fw={600} fz="xl">
                      Verificação em duas etapas
                    </Text>
                  </Stack>
                  <Text c="danger" mt="md">{error}</Text>
                  <Anchor component={Link} href="/login" underline="always" mt="md" display="block">
                    Voltar para o login
                  </Anchor>
                </div>
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
            <Logo alt="Cdorneles" height={48} />
          </Stack>
        </Stack>
      </Flex>
    </Flex>
  );
}
