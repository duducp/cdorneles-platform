"use client";

import { Box, ScrollArea, Stack, Text } from "@mantine/core";
import type { LucideIcon } from "lucide-react";
import type { ComponentType, ElementType } from "react";

import { AppVersion } from "../components/app-version";
import { Logo } from "../components/logo";
import { NavItem } from "./nav-item";

export interface SidebarNavItem {
  label: string;
  href: string;
  icon: LucideIcon;
  /**
   * Optional section title. Items sharing a section render under one caps
   * label, grouped by first appearance; items without a section render first
   * in an untitled group, so current layouts keep working unchanged.
   */
  section?: string;
}

export interface SidebarProps {
  items: SidebarNavItem[];
  activeHref: string;
  collapsed?: boolean;
  /** Anchor element for the nav links; Next apps pass `next/link`. */
  linkComponent?: ElementType;
  /** Rendered beside a label while its navigation is pending. */
  pendingComponent?: ComponentType;
}

interface NavGroup {
  /** `undefined` for the leading untitled group. */
  section: string | undefined;
  items: SidebarNavItem[];
}

/** Groups items by section, keeping first-appearance order. */
function groupBySection(items: SidebarNavItem[]): NavGroup[] {
  const groups: NavGroup[] = [];
  const index = new Map<string, NavGroup>();
  for (const item of items) {
    const key = item.section ?? "";
    let group = index.get(key);
    if (!group) {
      group = { section: item.section, items: [] };
      index.set(key, group);
      groups.push(group);
    }
    group.items.push(item);
  }
  return groups;
}

export function Sidebar({
  items,
  activeHref,
  collapsed,
  linkComponent,
  pendingComponent,
}: SidebarProps) {
  return (
    <Stack component="nav" gap="xs" p="md" h="100%">
      <Box px="xs" py="sm">
        <Logo variant={collapsed ? "symbol" : "horizontal"} alt="Logo" />
      </Box>

      <ScrollArea flex={1}>
        <Stack gap="md">
          {groupBySection(items).map((group) => (
            <Stack key={group.section ?? "__untitled"} gap={2}>
              {group.section && !collapsed ? (
                <Text size="xs" fw={600} c="dimmed" tt="uppercase" px="xs" pt="xs">
                  {group.section}
                </Text>
              ) : null}
              {group.items.map((item) => (
                <NavItem
                  key={item.href}
                  label={item.label}
                  href={item.href}
                  icon={item.icon}
                  active={activeHref.startsWith(item.href)}
                  collapsed={collapsed}
                  linkComponent={linkComponent}
                  pendingComponent={pendingComponent}
                />
              ))}
            </Stack>
          ))}
        </Stack>
      </ScrollArea>

      <Box ta="center" pt="xs">
        <AppVersion />
      </Box>
    </Stack>
  );
}
