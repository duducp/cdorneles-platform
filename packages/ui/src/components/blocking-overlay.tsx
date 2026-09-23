"use client";

import { Box, Loader, Stack, Text } from "@mantine/core";

export interface BlockingOverlayProps {
  visible: boolean;
  label?: string;
}

/** A blocking, theme-coloured overlay with a spinner and a short label. */
export function BlockingOverlay({ visible, label = "Entrando…" }: BlockingOverlayProps) {
  if (!visible) return null;
  return (
    <Box
      pos="absolute"
      inset={0}
      bg="var(--mantine-color-body)"
      style={{
        zIndex: 300,
        opacity: 0.85,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <Stack align="center" gap="xs">
        <Loader size="sm" />
        <Text size="sm" c="dimmed">
          {label}
        </Text>
      </Stack>
    </Box>
  );
}
