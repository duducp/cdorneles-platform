"use client";

import { Center, Stack, Text, ThemeIcon, Title } from "@mantine/core";
import { Inbox, type LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

export interface EmptyStateProps {
  title: string;
  description?: ReactNode;
  icon?: LucideIcon;
  action?: ReactNode;
  minHeight?: number;
}

/** Neutral empty state for lists/collections with no data. */
export function EmptyState({
  title,
  description,
  icon: Icon = Inbox,
  action,
  minHeight = 220,
}: EmptyStateProps) {
  return (
    <Center mih={minHeight} px="md">
      <Stack align="center" gap="sm" maw={420} ta="center">
        <ThemeIcon variant="light" color="gray" size="xl" radius="md">
          <Icon size={22} aria-hidden />
        </ThemeIcon>
        <Title order={4} fz="md">
          {title}
        </Title>
        {description ? (
          <Text c="dimmed" size="sm">
            {description}
          </Text>
        ) : null}
        {action}
      </Stack>
    </Center>
  );
}
