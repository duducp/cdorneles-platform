"use client";

import { Stack, Text } from "@mantine/core";

import { AppVersion } from "../components/app-version";
import { Logo } from "../components/logo";

/**
 * Brand footer shared by the public auth pages: the horizontal logo, the build
 * version and the Turnstile protection notice (rendered only when a site key
 * is configured — the notice would be false otherwise).
 */
export function AuthFooter() {
  return (
    <Stack component="footer" align="center" gap="sm">
      <Logo alt="Carlos Dorneles" variant="horizontal" height={32} />
      <AppVersion />
      {process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY ? (
        <Text size="xs" c="dimmed">
          Protegido pelo Cloudflare Turnstile
        </Text>
      ) : null}
    </Stack>
  );
}
