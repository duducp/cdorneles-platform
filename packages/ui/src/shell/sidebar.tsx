"use client";

import { Box, ScrollArea, Stack } from "@mantine/core";
import type { ElementType } from "react";
import type { LucideIcon } from "lucide-react";
import { AppVersion } from "../components/app-version";
import { Logo } from "../components/logo";
import { NavItem } from "./nav-item";

export interface SidebarNavItem {
  label: string;
  href: string;
  icon: LucideIcon;
}

export interface SidebarProps {
  items: SidebarNavItem[];
  activeHref: string;
  collapsed?: boolean;
  /** Anchor element for the nav links; Next apps pass `next/link`. */
  linkComponent?: ElementType;
}

export function Sidebar({ items, activeHref, collapsed, linkComponent }: SidebarProps) {
  return (
    <Stack gap="xs" p="md" h="100%">
      <Box px="xs" py="sm">
        <Logo variant={collapsed ? "default" : "horizontal"} alt="Logo" />
      </Box>

      <ScrollArea flex={1}>
        <Stack gap={2}>
          {items.map((item) => (
            <NavItem
              key={item.href}
              label={item.label}
              href={item.href}
              icon={item.icon}
              active={activeHref.startsWith(item.href)}
              collapsed={collapsed}
              linkComponent={linkComponent}
            />
          ))}
        </Stack>
      </ScrollArea>

      <Box ta="center" pt="xs">
        <AppVersion />
      </Box>
    </Stack>
  );
}
