"use client";

import { AppShell as MantineAppShell } from "@mantine/core";
import type { ReactNode } from "react";

export interface AppShellProps {
  sidebar: ReactNode;
  topbar: ReactNode;
  children: ReactNode;
}

export function AppShell({ sidebar, topbar, children }: AppShellProps) {
  return (
    <MantineAppShell
      header={{ height: 60 }}
      navbar={{ width: 260, breakpoint: "md" }}
      padding="md"
    >
      <MantineAppShell.Header>{topbar}</MantineAppShell.Header>
      <MantineAppShell.Navbar>{sidebar}</MantineAppShell.Navbar>
      <MantineAppShell.Main>{children}</MantineAppShell.Main>
    </MantineAppShell>
  );
}
