"use client";

import { Center, Stack, Text, ThemeIcon, Title } from "@mantine/core";
import { AlertTriangle } from "lucide-react";
import type { ReactNode } from "react";

import { Button } from "../components/button";

export interface ErrorStateProps {
  title?: string;
  description?: ReactNode;
  onRetry?: () => void;
  retryLabel?: string;
  minHeight?: number;
}

/** Accessible error state with an optional retry action. */
export function ErrorState({
  title = "Something went wrong",
  description,
  onRetry,
  retryLabel = "Try again",
  minHeight = 220,
}: ErrorStateProps) {
  return (
    <Center mih={minHeight} px="md" role="alert">
      <Stack align="center" gap="sm" maw={420} ta="center">
        <ThemeIcon variant="light" color="danger" size="xl" radius="md">
          <AlertTriangle size={22} aria-hidden />
        </ThemeIcon>
        <Title order={4} fz="md">
          {title}
        </Title>
        {description ? (
          <Text c="dimmed" size="sm">
            {description}
          </Text>
        ) : null}
        {onRetry ? (
          <Button variant="secondary" onClick={onRetry}>
            {retryLabel}
          </Button>
        ) : null}
      </Stack>
    </Center>
  );
}
