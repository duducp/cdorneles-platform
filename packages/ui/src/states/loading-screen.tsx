"use client";

import { Flex, Loader, Stack } from "@mantine/core";

import { AppVersion } from "../components/app-version";
import { Logo } from "../components/logo";

export interface LoadingScreenProps {
  /** Accessible name announced while loading; never rendered as visible text. */
  label?: string;
  /** Brand name used as the logo alt text. */
  alt?: string;
  /**
   * Minimum height. Defaults to the shell content area (`100dvh` minus the
   * AppShell header offset and padding). Pass a smaller value to preview it
   * outside the shell, e.g. in the design-system gallery.
   */
  minHeight?: string;
}

const DEFAULT_MIN_HEIGHT =
  "calc(100dvh - var(--app-shell-header-offset, 0rem) - 2 * var(--app-shell-padding, 0rem))";

/**
 * Route-level loading screen: the brand logo and build version sit centred, and
 * the spinner is pinned to the bottom of the content area.
 *
 * The route `loading.tsx` renders inside the authenticated shell, where
 * `AppShell.Main` is already the page's `<main>`, so this component deliberately
 * adds no `<main>` of its own. Its height fills the shell content area (the
 * AppShell header offset and padding are subtracted) instead of forcing
 * `100dvh`, which would overflow by the header height.
 */
export function LoadingScreen({
  label = "Carregando",
  alt = "Cdorneles",
  minHeight = DEFAULT_MIN_HEIGHT,
}: LoadingScreenProps) {
  return (
    <Flex direction="column" mih={minHeight} p="xl">
      <Flex align="center" justify="center" flex={1}>
        <Stack align="center" gap="sm">
          <Logo alt={alt} variant="horizontal" height={40} />
          <AppVersion />
        </Stack>
      </Flex>
      <Flex component="footer" justify="center" py="md">
        <Flex role="status" aria-live="polite" aria-label={label}>
          <Loader size="sm" aria-hidden />
        </Flex>
      </Flex>
    </Flex>
  );
}
