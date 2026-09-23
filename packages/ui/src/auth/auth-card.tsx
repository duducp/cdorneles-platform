"use client";

import { Box, Flex, Paper } from "@mantine/core";
import type { ReactNode } from "react";

import { BlockingOverlay } from "../components/blocking-overlay";

export interface AuthCardProps {
  form: ReactNode;
  visual?: ReactNode;
  /** Blocks the card with an overlay while an external step runs. */
  loading?: boolean;
}

/**
 * The two-panel auth card: form on the left (slightly wider), visual on the
 * right. Centered by the page; the visual is hidden below the `md` breakpoint.
 * The card owns the form panel padding — slots pass content only.
 */
export function AuthCard({ form, visual, loading }: AuthCardProps) {
  return (
    <Paper
      w="100%"
      maw={920}
      mx="auto"
      radius="lg"
      shadow="sm"
      withBorder
      pos="relative"
      style={{ overflow: "hidden" }}
    >
      <BlockingOverlay visible={loading ?? false} />
      <Flex
        align="stretch"
        mih={{ base: "auto", sm: 560 }}
        inert={loading || undefined}
        aria-busy={loading || undefined}
      >
        <Flex direction="column" justify="center" p="xl" flex="1.05 1 0" miw={0}>
          {form}
        </Flex>
        {visual ? (
          <Box visibleFrom="md" flex="1 1 0" miw={0}>
            {visual}
          </Box>
        ) : null}
      </Flex>
    </Paper>
  );
}
