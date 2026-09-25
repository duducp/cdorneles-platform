"use client";

import { Anchor, Breadcrumbs, Text } from "@mantine/core";
import type { ElementType } from "react";

import type { SidebarNavItem } from "./sidebar";

export interface Crumb {
  label: string;
  href: string;
}

function capitalize(segment: string): string {
  return segment.charAt(0).toUpperCase() + segment.slice(1);
}

/**
 * Derives the breadcrumb trail from the pathname. The first segment uses the
 * matching nav item's label (so "Customers" never renders as "Customers");
 * deeper segments are capitalized. Exported for unit testing.
 */
export function deriveTrail(pathname: string, items: SidebarNavItem[]): Crumb[] {
  const segments = pathname.split("/").filter(Boolean);
  if (segments.length === 0) return [];

  const trail: Crumb[] = [];
  for (let index = 0; index < segments.length; index += 1) {
    const href = `/${segments.slice(0, index + 1).join("/")}`;
    const matched = items.find((item) => item.href === href);
    trail.push({ label: matched?.label ?? capitalize(segments[index]!), href });
  }
  return trail;
}

export interface BreadcrumbTrailProps {
  trail: Crumb[];
  /** Anchor element for crumbs; Next apps pass `next/link`. */
  linkComponent?: ElementType;
}

/**
 * The console-style breadcrumb trail for the topbar. Earlier crumbs are
 * links; the last crumb is the current page: plain text with
 * `aria-current="page"`.
 */
export function BreadcrumbTrail({
  trail,
  linkComponent: LinkComponent = "a",
}: BreadcrumbTrailProps) {
  if (trail.length === 0) return null;

  const last = trail[trail.length - 1]!;
  const rest = trail.slice(0, -1);

  return (
    <Breadcrumbs separator="/" visibleFrom="md" component="nav" aria-label="Breadcrumb">
      {rest.map((crumb) => (
        <Anchor
          key={crumb.href}
          component={LinkComponent as "a"}
          href={crumb.href}
          size="sm"
          underline="never"
          c="dimmed"
        >
          {crumb.label}
        </Anchor>
      ))}
      <Text size="sm" fw={500} span aria-current="page">
        {last.label}
      </Text>
    </Breadcrumbs>
  );
}
