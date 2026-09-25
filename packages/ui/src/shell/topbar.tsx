"use client";

import { Burger, Group, TextInput } from "@mantine/core";
import { Search } from "lucide-react";
import type { ElementType, ReactNode } from "react";

import { ThemeToggle } from "../components/theme-toggle";
import { BreadcrumbTrail, type Crumb } from "./breadcrumbs";
import { UserMenu } from "./user-menu";

export interface TopbarProps {
  /**
   * Brand slot, rendered at the far left. Apps pass the platform `Logo`
   * (symbol variant) or the organization's white-label brand.
   */
  logo?: ReactNode;
  /**
   * Rendered right after the logo — the organization switcher on org-scoped
   * apps. Nothing renders when omitted (e.g. the admin panel).
   */
  leftSection?: ReactNode;
  /**
   * Pre-derived breadcrumb trail. `createShellLayout` derives it from the
   * pathname; apps can pass their own or leave it empty.
   */
  breadcrumbTrail?: Crumb[];
  /** Anchor element for breadcrumb crumbs; Next apps pass `next/link`. */
  breadcrumbLinkComponent?: ElementType;
  /**
   * Filter input value. Provided, the input renders as a controlled field;
   * omitted it renders visually only, without wiring.
   */
  filterValue?: string;
  onFilterChange?: (value: string) => void;
  userName: string;
  userEmail?: string;
  /** Avatar photo URL; falls back to initials when absent. */
  userPhoto?: string | null;
  sidebarOpened: boolean;
  onToggleSidebar: () => void;
  onLogout: () => void;
}

export function Topbar({
  logo,
  leftSection,
  breadcrumbTrail,
  breadcrumbLinkComponent,
  filterValue,
  onFilterChange,
  userName,
  userEmail,
  userPhoto,
  sidebarOpened,
  onToggleSidebar,
  onLogout,
}: TopbarProps) {
  return (
    <Group h="100%" px="md" justify="space-between" wrap="nowrap" gap="sm">
      <Group gap="sm" wrap="nowrap">
        <Burger opened={sidebarOpened} onClick={onToggleSidebar} hiddenFrom="md" size="sm" />
        {logo}
        {leftSection}
        <BreadcrumbTrail
          trail={breadcrumbTrail ?? []}
          linkComponent={breadcrumbLinkComponent ?? "a"}
        />
      </Group>

      <Group gap="sm" wrap="nowrap">
        <TextInput
          placeholder="Filtrar..."
          aria-label="Filtrar"
          leftSection={<Search size={14} aria-hidden />}
          size="xs"
          w={180}
          visibleFrom="sm"
          value={filterValue}
          onChange={(event) => onFilterChange?.(event.currentTarget.value)}
        />
        <ThemeToggle />
        <UserMenu
          userName={userName}
          userEmail={userEmail}
          userPhoto={userPhoto}
          onLogout={onLogout}
        />
      </Group>
    </Group>
  );
}
