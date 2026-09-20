"use client";

import { useAuth } from "@cdorneles/auth";
import { useTenant } from "@cdorneles/tenant";
import { LoadingState, Logo, ThemeToggle } from "@cdorneles/ui";
import { OrgPicker } from "@cdorneles/ui/tenant";
import { Flex, Stack, Title, VisuallyHidden } from "@mantine/core";
import { useRouter } from "next/navigation";
import { useState } from "react";

export default function SelectOrgPage() {
  const { status } = useAuth();
  const { organizations, currentOrganization, switchOrganization } = useTenant();
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  function handleSelect(organizationId: string) {
    setLoading(true);
    const success = switchOrganization(organizationId);
    if (success) {
      router.push("/");
    }
    setLoading(false);
  }

  if (status !== "authenticated") {
    return (
      <Flex direction="column" mih="100dvh" align="center" justify="center">
        <LoadingState label="Carregando..." minHeight={0} />
      </Flex>
    );
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
        <Stack w="100%" maw={480} gap="xl">
          <VisuallyHidden>
            <Title order={1}>Selecionar organização</Title>
          </VisuallyHidden>
          <OrgPicker
            organizations={organizations}
            currentOrganizationId={currentOrganization?.id}
            onSelect={handleSelect}
            loading={loading}
          />

          <Stack component="footer" align="center" gap="sm">
            <Logo alt="Cdorneles" variant="horizontal" height={32} />
          </Stack>
        </Stack>
      </Flex>
    </Flex>
  );
}
