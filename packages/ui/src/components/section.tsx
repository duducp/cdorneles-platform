"use client";

import { Group, Stack, Text, Title } from "@mantine/core";
import type { ReactNode } from "react";

export interface SectionProps {
  title?: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
}

/** Titled content section used to compose pages consistently. */
export function Section({ title, description, actions, children }: SectionProps) {
  const hasHeader = Boolean(title || actions);

  return (
    <Stack component="section" gap="md">
      {hasHeader ? (
        <Group justify="space-between" align="flex-end" gap="md" wrap="wrap">
          <Stack gap={2} style={{ minWidth: 0 }}>
            {title ? (
              <Title order={3} fz="lg">
                {title}
              </Title>
            ) : null}
            {description ? (
              <Text c="dimmed" size="sm">
                {description}
              </Text>
            ) : null}
          </Stack>
          {actions ? (
            <Group gap="sm" wrap="wrap">
              {actions}
            </Group>
          ) : null}
        </Group>
      ) : null}
      {children}
    </Stack>
  );
}
