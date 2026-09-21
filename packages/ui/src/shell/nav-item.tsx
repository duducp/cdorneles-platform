"use client";

import { NavLink, Tooltip } from "@mantine/core";
import type { LucideIcon } from "lucide-react";

export interface NavItemProps {
  label: string;
  href: string;
  icon: LucideIcon;
  active?: boolean;
  collapsed?: boolean;
  onClick?: () => void;
}

export function NavItem({
  label,
  href,
  icon: Icon,
  active,
  collapsed,
  onClick,
}: NavItemProps) {
  const link = (
    <NavLink
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
