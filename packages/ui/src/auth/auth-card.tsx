"use client";

import { Box } from "@mantine/core";
import type { ReactNode } from "react";

export interface AuthCardProps {
  form: ReactNode;
  visual?: ReactNode;
}

/**
 * The two-panel auth card: form on the left (slightly wider), visual on the
 * right. Centered by the page; the visual is hidden below the `sm` breakpoint.
 */
export function AuthCard({ form, visual }: AuthCardProps) {
  return (
    <Box
      style={{
        width: "100%",
        maxWidth: 920,
        marginInline: "auto",
        borderRadius: "var(--mantine-radius-lg)",
        border: "1px solid var(--mantine-color-default-border)",
        overflow: "hidden",
        background: "var(--mantine-color-body)",
        boxShadow: "var(--mantine-shadow-sm)",
      }}
    >
      <Box style={{ display: "flex", alignItems: "stretch", minHeight: 560 }}>
        <Box style={{ flex: "1.05 1 0", minWidth: 0 }}>{form}</Box>
        {visual ? (
          <Box visibleFrom="sm" style={{ flex: "1 1 0", minWidth: 0 }}>
            {visual}
          </Box>
        ) : null}
      </Box>
    </Box>
  );
}
