"use client";

import { useTenant } from "@cdorneles/tenant";
import { PageContainer, PageHeader } from "@cdorneles/ui";
import { Text } from "@mantine/core";

export function DashboardPage() {
  const { currentOrganization } = useTenant();

  return (
    <PageContainer py="xl">
      <PageHeader title="Dashboard" description="Organization overview." />
      <Text c="dimmed">
        Overview of {currentOrganization?.name ?? "your organization"}.
      </Text>
    </PageContainer>
  );
}

export default DashboardPage;
