"use client";

import { NavLink, Tooltip } from "@mantine/core";
import type { LucideIcon } from "lucide-react";
import type { ElementType } from "react";

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
   * navigation stays client-side and route-level loading states can run.
   */
  linkComponent?: ElementType;
}

export function NavItem({
  label,
  href,
  icon: Icon,
  active,
  collapsed,
  onClick,
  linkComponent: LinkComponent = "a",
}: NavItemProps) {
  const link = (
    <NavLink
      // Mantine types `component` polymorphically from the props, which cannot
      // be expressed for a forwarded component. The runtime accepts any element
      // type, so the cast only narrows what TypeScript sees.
      component={LinkComponent as "a"}
      href={href}
      label={collapsed ? undefined : label}
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
