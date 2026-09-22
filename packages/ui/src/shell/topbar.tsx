"use client";

import { Box, Burger, Group } from "@mantine/core";
import { ThemeToggle } from "../components/theme-toggle";
import { UserMenu } from "./user-menu";

export interface TopbarProps {
  userName: string;
  userEmail?: string;
  sidebarOpened: boolean;
  onToggleSidebar: () => void;
  onLogout: () => void;
}

export function Topbar({
  userName,
  userEmail,
  sidebarOpened,
  onToggleSidebar,
  onLogout,
}: TopbarProps) {
  return (
    <Group h="100%" px="md" justify="space-between">
      <Burger opened={sidebarOpened} onClick={onToggleSidebar} hiddenFrom="md" size="sm" />
      <Box flex={1} />
      <Group gap="sm">
        <ThemeToggle />
        <UserMenu userName={userName} userEmail={userEmail} onLogout={onLogout} />
      </Group>
    </Group>
  );
}
