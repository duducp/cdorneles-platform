"use client";

import { Loader } from "@mantine/core";
import { useLinkStatus } from "next/link";

/**
 * A spinner shown beside a nav label while its link's navigation is pending.
 *
 * Lives here rather than in `@cdorneles/ui` so the design system keeps no
 * framework dependency: the shell renders whatever component it is handed, and
 * this one is the Next-aware piece.
 */
export function NavPendingIndicator() {
  const { pending } = useLinkStatus();

  if (!pending) {
    return null;
  }

  return <Loader size={12} aria-label="Carregando" />;
}
