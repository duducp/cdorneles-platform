"use client";

import { useTenant } from "@cdorneles/tenant";
import { PageContainer, PageHeader } from "@cdorneles/ui";
import { Text } from "@mantine/core";

export function SettingsPage() {
  const { currentOrganization } = useTenant();

  return (
    <PageContainer py="xl">
      <PageHeader title="Settings" description="Manage your settings." />
      <Text c="dimmed">
        Manage settings for {currentOrganization?.name ?? "your organization"}.
      </Text>
    </PageContainer>
  );
}

export default SettingsPage;
