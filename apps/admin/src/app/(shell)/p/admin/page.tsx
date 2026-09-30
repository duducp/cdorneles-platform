"use client";

import { GroupIndex, groupIndexItems, type RouteGroup } from "@cdorneles/ui/shell";
import Link from "next/link";

import { ADMIN_ROUTES, PORTAL_PREFIX } from "@cdorneles/app";

/**
 * The `/p/admin` group index (Django-admin style): lists the group's pages.
 * Permission filtering is a UX courtesy here; every child page gates itself.
 */
export default function AdminGroupIndexPage() {
  const group = ADMIN_ROUTES.find(
    (route): route is RouteGroup =>
      route.kind === "group" && route.href === `${PORTAL_PREFIX}/admin`,
  );
  if (!group) return null;

  return (
    <GroupIndex
      title={group.label}
      description={group.description}
      items={groupIndexItems(group)}
      linkComponent={Link}
    />
  );
}
