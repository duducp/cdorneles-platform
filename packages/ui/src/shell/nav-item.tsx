"use client";

import { Group, NavLink, Tooltip } from "@mantine/core";
import type { LucideIcon } from "lucide-react";
import type { ComponentType, ElementType } from "react";

export interface NavItemProps {
  label: string;
  href: string;
  icon: LucideIcon;
  active?: boolean;
  collapsed?: boolean;
  onClick?: () => void;
  /**
   * Element used to render the anchor. Defaults to a plain `<a>`, which
   * reloads the whole page; Next.js applications pass `next/link` so
   * navigation stays client-side.
   */
  linkComponent?: ElementType;
  /**
   * Rendered beside the label while the link's navigation is pending. It runs
   * inside the anchor, so a Next.js application can pass a component backed by
   * `useLinkStatus` — the design system stays free of a framework dependency.
   */
  pendingComponent?: ComponentType;
}

function NavLabel({
  label,
  pendingComponent: Pending,
}: {
  label: string;
  pendingComponent: ComponentType;
}) {
  return (
    <Group gap="xs" wrap="nowrap">
      <span>{label}</span>
      <Pending />
    </Group>
  );
}

export function NavItem({
  label,
  href,
  icon: Icon,
  active,
  collapsed,
  onClick,
  linkComponent: LinkComponent = "a",
  pendingComponent,
}: NavItemProps) {
  const showLabel = !collapsed;
  const link = (
    <NavLink
      // Mantine types `component` polymorphically from the props, which cannot
      // be expressed for a forwarded component. The runtime accepts any element
      // type, so the cast only narrows what TypeScript sees.
      component={LinkComponent as "a"}
      href={href}
      label={
        showLabel && pendingComponent ? (
          <NavLabel label={label} pendingComponent={pendingComponent} />
        ) : showLabel ? (
          label
        ) : undefined
      }
      leftSection={<Icon size={20} />}
      active={active}
      onClick={onClick}
      variant="subtle"
    />
  );

  if (collapsed) {
    return (
      <Tooltip label={label} position="right" withArrow>
        {link}
      </Tooltip>
    );
  }

  return link;
}
