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
      role="status"
      aria-live="polite"
      bg="color-mix(in srgb, var(--mantine-color-body) 85%, transparent)"
      style={{
        zIndex: 300,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <Stack align="center" gap="xs">
        <Loader size="sm" aria-hidden />
        <Text size="sm" c="dimmed">
          {label}
        </Text>
      </Stack>
    </Box>
  );
}
