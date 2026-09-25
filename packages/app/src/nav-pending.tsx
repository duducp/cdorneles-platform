"use client";

import { usePendingLink } from "@cdorneles/ui/shell";
import { Loader } from "@mantine/core";
import { useLinkStatus } from "next/link";

/**
 * A spinner shown beside a nav label while its link's navigation is pending,
 * and the reporter that feeds the top `NavigationProgress` bar.
 *
 * Lives here rather than in `@cdorneles/ui` so the design system keeps no
 * framework dependency: the shell renders whatever component it is handed, and
 * this one is the Next-aware piece.
 */
export function NavPendingIndicator() {
  const { pending } = useLinkStatus();
  usePendingLink(pending);

  if (!pending) {
    return null;
  }

  return <Loader size={12} aria-label="Carregando" />;
}
