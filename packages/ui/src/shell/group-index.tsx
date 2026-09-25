"use client";

import { Box, Group, Paper, Stack, Text, Title } from "@mantine/core";
import type { ElementType } from "react";

import type { GroupIndexItem } from "./route-registry";

export interface GroupIndexLinkProps {
  /** Anchor element for the item links; Next apps pass `next/link`. */
  linkComponent?: ElementType;
}

export interface GroupIndexProps extends GroupIndexLinkProps {
  /** The group's visible name, e.g. "Administração". */
  title: string;
  /** Shown under the title. */
  description?: string;
  /** The group's visible pages, from `groupIndexItems`. */
  items: GroupIndexItem[];
}

/**
 * The Django-admin-style group index: one row per visible page with its
 * description, linking to the list. Rendered at the group root (`/admin`,
 * `/crm`…). Items arrive already permission-filtered by `visibleRoutes`.
 */
export function GroupIndex({ title, description, items, linkComponent: Link }: GroupIndexProps) {
  return (
    <Stack gap="md" data-testid="group-index">
      <Stack gap={4}>
        <Title order={2} fz="xl">
          {title}
        </Title>
        {description ? (
          <Text c="dimmed" size="sm">
            {description}
          </Text>
        ) : null}
      </Stack>

      <Paper withBorder radius="md">
        {items.length === 0 ? (
          <Text c="dimmed" size="sm" p="md">
            Nenhum item disponível.
          </Text>
        ) : (
          items.map((item) => (
            <Box
              key={item.href}
              // Mantine types `component` polymorphically from the props, which
              // cannot be expressed for a forwarded component. The runtime
              // accepts any element type, so the cast only narrows what
              // TypeScript sees (same approach as `NavItem`).
              component={Link as "a"}
              href={item.href}
              display="block"
              p="md"
              style={{
                borderRadius: "var(--mantine-radius-md)",
                cursor: "pointer",
              }}
            >
              <Group justify="space-between" wrap="nowrap" gap="md">
                <Group gap="sm" wrap="nowrap" style={{ minWidth: 0 }}>
                  <item.icon size={18} aria-hidden />
                  <Stack gap={2} style={{ minWidth: 0 }}>
                    <Text fw={500} size="sm">
                      {item.label}
                    </Text>
                    {item.description ? (
                      <Text c="dimmed" size="xs" lineClamp={2}>
                        {item.description}
                      </Text>
                    ) : null}
                  </Stack>
                </Group>
              </Group>
            </Box>
          ))
        )}
      </Paper>
    </Stack>
  );
}
