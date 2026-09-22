"use client";

import { useAuth } from "@cdorneles/auth";
import { useTenant } from "@cdorneles/tenant";
import { Button, LoadingScreen, Logo, ThemeToggle } from "@cdorneles/ui";
import { CreateOrganizationForm, OrgPicker } from "@cdorneles/ui/tenant";
import { Flex, Modal, Stack, Title, VisuallyHidden } from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import { useRouter } from "next/navigation";
import { useState } from "react";

export function SelectOrgPage() {
  const { status } = useAuth();
  const { organizations, currentOrganization, switchOrganization, createOrganization } =
    useTenant();
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [createOpened, { open: openCreate, close: closeCreate }] = useDisclosure(false);

  function handleSelect(organizationId: string) {
    setLoading(true);
    const success = switchOrganization(organizationId);
    if (success) {
      router.push("/");
      return;
    }
    setLoading(false);
  }

  async function handleCreate(name: string) {
    const organization = await createOrganization(name);
    closeCreate();
    switchOrganization(organization.id);
    router.push("/");
  }

  if (status !== "authenticated") {
    return <LoadingScreen />;
  }

  return (
    <Flex direction="column" mih="100dvh">
      <Flex justify="flex-end" p="sm">
        <ThemeToggle />
      </Flex>

      <Flex component="main" align="center" justify="center" p="md" style={{ flex: 1 }}>
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

          <Button variant="subtle" onClick={openCreate}>
            Create organization
          </Button>

          <Modal opened={createOpened} onClose={closeCreate} title="New organization" centered>
            <CreateOrganizationForm onCreate={handleCreate} onCancel={closeCreate} />
          </Modal>

          <Stack component="footer" align="center" gap="sm">
            <Logo alt="Cdorneles" height={48} />
          </Stack>
        </Stack>
      </Flex>
    </Flex>
  );
}
