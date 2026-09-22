"use client";

import { Text } from "@mantine/core";

/**
 * The build's version, from `NEXT_PUBLIC_APP_VERSION`.
 *
 * `tooling/next-config.mjs` bakes the root package.json version in at build
 * time (release-please bumps it), so this needs no runtime configuration.
 */
const APP_VERSION = process.env.NEXT_PUBLIC_APP_VERSION;

export interface AppVersionProps {
  /** Text size; defaults to `xs`. */
  size?: string;
  /** Render nothing when the version is unknown (e.g. a build without it). */
  fallback?: string;
}

/** Small, dimmed build label — for sidebars and page footers. */
export function AppVersion({ size = "xs", fallback }: AppVersionProps) {
  if (!APP_VERSION) {
    return fallback ? (
      <Text size={size} c="dimmed">
        {fallback}
      </Text>
    ) : null;
  }

  return (
    <Text size={size} c="dimmed">
      v{APP_VERSION}
    </Text>
  );
}
