"use client";

import { useAuth } from "@cdorneles/auth";
import { AuthCard, AuthVisual, MfaChallengeForm, Logo, ThemeToggle } from "@cdorneles/ui";
import { Anchor, Box, Group, Stack, Text } from "@mantine/core";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

export default function MfaPage() {
  const { service, completeMfa } = useAuth();
  const router = useRouter();
  const [challengeId, setChallengeId] = useState<string | null>(null);
  const [factor, setFactor] = useState<"email" | "totp">("email");
  const [error, setError] = useState<string | null>(null);

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
      } catch {
        if (!cancelled) setError("Erro ao iniciar desafio MFA.");
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
      /* resend errors are non-critical */
    }
  }, [service, factor]);

  return (
    <Box style={{ display: "flex", flexDirection: "column", minHeight: "100dvh" }}>
      <Group justify="flex-end" p="md">
        <ThemeToggle />
      </Group>

      <Box
        component="main"
        style={{
          flex: 1,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: "var(--mantine-spacing-md)",
        }}
      >
        <Stack w="100%" maw={920} gap="xl">
          <AuthCard
            form={
              !challengeId && !error ? (
                <Text c="dimmed" ta="center">
                  Carregando desafio MFA...
                </Text>
              ) : error ? (
                <div role="alert">
                  <p>{error}</p>
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
      </Box>
    </Box>
  );
}
