"use client";

import { Center, Loader, Stack, Text } from "@mantine/core";

export interface LoadingStateProps {
  label?: string;
  minHeight?: number;
}

/** Accessible loading indicator. */
export function LoadingState({ label = "Loading…", minHeight = 220 }: LoadingStateProps) {
  return (
    <Center mih={minHeight} role="status" aria-live="polite">
      <Stack align="center" gap="sm">
        <Loader size="md" />
        <Text c="dimmed" size="sm">
          {label}
        </Text>
      </Stack>
    </Center>
  );
}
