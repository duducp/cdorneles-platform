"use client";

import { Box, Flex, Paper } from "@mantine/core";
import type { ReactNode } from "react";

export interface AuthCardProps {
  form: ReactNode;
  visual?: ReactNode;
}

/**
 * The two-panel auth card: form on the left (slightly wider), visual on the
 * right. Centered by the page; the visual is hidden below the `md` breakpoint.
 */
export function AuthCard({ form, visual }: AuthCardProps) {
  return (
    <Paper
      w="100%"
      maw={920}
      mx="auto"
      radius="lg"
      shadow="sm"
      withBorder
      style={{ overflow: "hidden" }}
    >
      <Flex align="stretch" mih={{ base: "auto", sm: 560 }}>
        <Flex direction="column" justify="center" flex="1.05 1 0" miw={0}>
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
