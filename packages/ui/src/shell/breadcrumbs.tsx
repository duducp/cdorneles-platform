"use client";

import { Anchor, Breadcrumbs, Text } from "@mantine/core";
import type { ElementType } from "react";

import { ROUTE_VERB_LABELS, flattenRoutes, type RouteEntry } from "./route-registry";
import type { SidebarNavItem } from "./sidebar";

export interface Crumb {
  label: string;
  href: string;
}

export interface DeriveTrailOptions {
  /**
   * A URL prefix every route lives under (e.g. `/p`). It never gets a crumb:
   * it is infrastructure, not a page, and would otherwise render a stray
   * capitalized segment ("P") ahead of the real trail.
   */
  skipPrefix?: string;
}

function capitalize(segment: string): string {
  return segment.charAt(0).toUpperCase() + segment.slice(1);
}

/**
 * Derives the breadcrumb trail from the pathname. Each segment resolves in
 * this order: an exact registry declaration for its href (so `/admin` renders
 * the group's full label), a nav item label, a pt-BR verb label (`add` →
 * "Novo", `change` → "Editar"), then a capitalized fallback.
 */
export function deriveTrail(
  pathname: string,
  items: SidebarNavItem[],
  registry?: readonly RouteEntry[],
  options?: DeriveTrailOptions,
): Crumb[] {
  const segments = pathname.split("/").filter(Boolean);
  if (segments.length === 0) return [];

  // The prefix stays in every crumb's href but never becomes a crumb itself.
  let prefix = "";
  let trailSegments = segments;
  const skipPrefix = options?.skipPrefix;
  if (skipPrefix && segments[0] === skipPrefix.replace(/\/+$/, "").slice(1)) {
    prefix = skipPrefix.replace(/\/+$/, "");
    trailSegments = segments.slice(1);
    if (trailSegments.length === 0) return [];
  }

  // Exact-href index of the declared routes (groups and pages).
  const declared = registry ? new Map(flattenRoutes(registry).map((r) => [r.href, r.entry])) : null;

  const trail: Crumb[] = [];
  for (let index = 0; index < trailSegments.length; index += 1) {
    const segment = trailSegments[index]!;
    const href = `${prefix}/${trailSegments.slice(0, index + 1).join("/")}`;
    const matched = items.find((item) => item.href === href);
    const label =
      declared?.get(href)?.label ??
      matched?.label ??
      ROUTE_VERB_LABELS[segment] ??
      capitalize(segment);
    trail.push({ label, href });
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
