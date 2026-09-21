"use client";

import { Box, ScrollArea, Stack } from "@mantine/core";
import type { LucideIcon } from "lucide-react";
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
}

export function Sidebar({ items, activeHref, collapsed }: SidebarProps) {
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
            />
          ))}
        </Stack>
      </ScrollArea>
    </Stack>
  );
}
