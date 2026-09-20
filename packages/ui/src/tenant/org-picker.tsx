"use client";

import { Button, Card, Flex, Stack, Text, Title } from "@mantine/core";
import { Building2, Check } from "lucide-react";

export interface OrgPickerOrganization {
  id: string;
  name: string;
}

export interface OrgPickerProps {
  organizations: OrgPickerOrganization[];
  currentOrganizationId?: string | null;
  onSelect: (organizationId: string) => void;
  loading?: boolean;
}

export function OrgPicker({
  organizations,
  currentOrganizationId,
  onSelect,
  loading = false,
}: OrgPickerProps) {
  if (organizations.length === 0) {
    return (
      <Card p="xl" radius="md" withBorder>
        <Stack align="center" gap="md">
          <Building2 aria-hidden size={48} />
          <Title order={3}>No organizations</Title>
          <Text c="dimmed" ta="center">
            You don&apos;t belong to any organization yet. Ask an admin to invite you.
          </Text>
        </Stack>
      </Card>
    );
  }

  return (
    <Card p="xl" radius="md" withBorder>
      <Stack gap="lg">
        <Stack gap={4}>
          <Title order={3}>Select organization</Title>
          <Text c="dimmed">Choose the organization you want to work in.</Text>
        </Stack>

        <Stack gap="sm">
          {organizations.map((org) => {
            const isSelected = org.id === currentOrganizationId;
            return (
              <Button
                key={org.id}
                variant={isSelected ? "filled" : "light"}
                justify="space-between"
                size="lg"
                radius="md"
                loading={loading}
                rightSection={isSelected ? <Check size={16} /> : undefined}
                onClick={() => onSelect(org.id)}
              >
                <Flex align="center" gap="sm">
                  <Building2 aria-hidden size={18} />
                  {org.name}
                </Flex>
              </Button>
            );
          })}
        </Stack>
      </Stack>
    </Card>
  );
}
