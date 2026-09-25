"use client";

import { Box, Divider, Group, Text, Title } from "@mantine/core";
import type { ReactNode } from "react";

export interface PageBodyProps {
  /** Page title (the shell carries the page's single h1 context). */
  title: string;
  /** Dimmed helper line under the title. */
  description?: ReactNode;
  /**
   * Primary action — the "Create" / "Add" button, rendered right-aligned on
   * the same row as the title, exactly like the Appwrite console's section
   * headers. Wrap it in a `PermissionGate` at the call site.
   */
  action?: ReactNode;
  /**
   * Right-side controls of the toolbar row that separates the header from the
   * content (search box, view toggles, bulk actions…). Wraps on narrow
   * screens.
   */
  toolbar?: ReactNode;
  /** The page's content: a `DataTable`, a form panel, cards… */
  children: ReactNode;
}

/**
 * The authenticated page's content area, modelled on the Appwrite console:
 * a title row with the primary action at the right, an optional toolbar row,
 * then the content — all inside one bordered surface so lists and forms read
 * as part of the same console "panel".
 */
export function PageBody({ title, description, action, toolbar, children }: PageBodyProps) {
  return (
    <Box>
      <Group justify="space-between" align="flex-start" gap="md" wrap="nowrap">
        <Box style={{ minWidth: 0 }}>
          <Title order={2} fz="xl">
            {title}
          </Title>
          {description ? (
            <Text c="dimmed" size="sm" mt={2}>
              {description}
            </Text>
          ) : null}
        </Box>
        {action ? (
          <Group gap="sm" wrap="nowrap">
            {action}
          </Group>
        ) : null}
      </Group>

      {toolbar ? (
        <>
          <Divider mt="md" mb="sm" />
          <Group gap="sm" wrap="wrap">
            {toolbar}
          </Group>
        </>
      ) : (
        <Divider mt="md" mb="md" />
      )}

      {children}
    </Box>
  );
}
