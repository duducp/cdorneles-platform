"use client";

import { Flex, Stack, VisuallyHidden } from "@mantine/core";
import { Suspense, type ReactNode } from "react";

import { AppVersion } from "../components/app-version";
import { Logo } from "../components/logo";
import { ThemeToggle } from "../components/theme-toggle";
import { AuthCard } from "./auth-card";

export interface AuthScreenProps {
  /** Content of the card's form panel. */
  form: ReactNode;
  /** Right-hand visual panel (login only); hidden below `md`. */
  visual?: ReactNode;
  /** Blocks the card with an overlay while an external step runs. */
  loading?: boolean;
  /** Text announced via a polite live region; the region stays mounted even
   *  when the value is an empty string so the text change is announced. */
  announcement?: string;
  /** Wrap the card in `<Suspense>` (reset-password reads `useSearchParams`). */
  suspense?: boolean;
}

/**
 * Full-screen shell shared by the public auth pages: ThemeToggle header,
 * `AuthCard` (max 920px) and the Logo/AppVersion footer. Below `md` the card
 * goes full-bleed via `[data-auth-card]` in each app's `globals.css`, the
 * content stretches to the top and the footer pins to the bottom
 * (`justify="space-between"` is a no-op at md+ where the stack has content
 * height and `align-items: center` applies).
 */
export function AuthScreen({ form, visual, loading, announcement, suspense }: AuthScreenProps) {
  const card = <AuthCard form={form} visual={visual} loading={loading} />;

  return (
    <Flex direction="column" mih="100dvh">
      <Flex justify="flex-end" p="sm">
        <ThemeToggle />
      </Flex>

      <Flex
        component="main"
        align={{ base: "stretch", md: "center" }}
        justify="center"
        p="md"
        flex={1}
      >
        {announcement !== undefined ? (
          <VisuallyHidden aria-live="polite">{announcement}</VisuallyHidden>
        ) : null}
        <Stack w="100%" maw={920} gap="xl" justify="space-between">
          {suspense ? <Suspense>{card}</Suspense> : card}

          <Stack component="footer" align="center" gap="sm">
            <Logo alt="Carlos Dorneles" variant="horizontal" height={32} />
            <AppVersion />
          </Stack>
        </Stack>
      </Flex>
    </Flex>
  );
}
