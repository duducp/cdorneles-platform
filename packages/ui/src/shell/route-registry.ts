import type { LucideIcon } from "lucide-react";

import type { AccessChecker, PermissionKey } from "@cdorneles/permissions";

export interface RoutePermissions {
  /** Every one of these is required to see the route (UX gate only). */
  allOf?: readonly PermissionKey[];
  /** At least one of these is required to see the route (UX gate only). */
  anyOf?: readonly PermissionKey[];
}

/**
 * A top-level route group (Django-admin style): `/admin`, `/crm`… The group
 * index lists its visible pages (and any child groups).
 */
export interface RouteGroup {
  kind: "group";
  /** URL path of the group index, e.g. `/admin`. */
  href: string;
  label: string;
  /** Shown to users on the group index. */
  description?: string;
  /** Free-form classification for future platform-wide filtering. */
  tags?: readonly string[];
  /** Permissions that gate the group index (UX gate only). */
  permissions?: RoutePermissions;
  icon: LucideIcon;
  /** Pages and child groups belonging to this group, in sidebar order. */
  items: RouteEntry[];
}

export interface RoutePage {
  kind: "page";
  /** URL path of the page. */
  href: string;
  label: string;
  /** Shown to users (group index rows, page bodies). */
  description?: string;
  /** Free-form classification for future platform-wide filtering. */
  tags?: readonly string[];
  /** Permissions that gate the page (UX gate only). */
  permissions?: RoutePermissions;
  icon: LucideIcon;
}

export type RouteEntry = RouteGroup | RoutePage;

/**
 * Labels for the implicit trailing path verbs, pt-BR. `deriveTrail` uses them
 * so `/users/add` renders "Usuários / Novo" without every app re-declaring it.
 */
export const ROUTE_VERB_LABELS: Readonly<Record<string, string>> = {
  add: "Novo",
  change: "Editar",
};

function allows(
  checker: Pick<AccessChecker, "hasAnyPermission" | "hasAllPermissions">,
  permissions: RoutePermissions | undefined,
): boolean {
  if (!permissions) return true;
  if (permissions.allOf && !checker.hasAllPermissions(permissions.allOf)) return false;
  if (permissions.anyOf && !checker.hasAnyPermission(permissions.anyOf)) return false;
  return true;
}

export interface VisibleRoute {
  href: string;
  label: string;
  description?: string;
  tags?: readonly string[];
  icon: LucideIcon;
  /** Child entries (groups only), already permission-filtered. */
  items?: VisibleRoute[];
}

/**
 * Filters a registry tree by the granted permissions, keeping declaration
 * order. Frontend authorization is UX only — the server remains the boundary.
 */
export function visibleRoutes(
  entries: readonly RouteEntry[],
  checker: Pick<AccessChecker, "hasAnyPermission" | "hasAllPermissions">,
): VisibleRoute[] {
  const result: VisibleRoute[] = [];
  for (const entry of entries) {
    if (!allows(checker, entry.permissions)) continue;
    if (entry.kind === "page") {
      result.push(entry);
      continue;
    }
    const items = visibleRoutes(entry.items, checker);
    if (items.length === 0) continue;
    result.push({ ...entry, items });
  }
  return result;
}

/** Flattens a registry tree into `{ href, entry }` pairs. */
export function flattenRoutes(entries: readonly RouteEntry[]): Array<{
  href: string;
  entry: RouteEntry;
}> {
  const result: Array<{ href: string; entry: RouteEntry }> = [];
  for (const entry of entries) {
    result.push({ href: entry.href, entry });
    if (entry.kind === "group") {
      result.push(...flattenRoutes(entry.items));
    }
  }
  return result;
}

/**
 * Finds the declared entry for a pathname. Trailing verbs (`/add`, `/change`)
 * and ids are trimmed so `/admin/users/abc/change` matches the `/admin/users`
 * page declaration.
 */
export function findRoute(
  entries: readonly RouteEntry[],
  pathname: string,
): RouteEntry | undefined {
  let match: RouteEntry | undefined;
  for (const { href, entry } of flattenRoutes(entries)) {
    if (pathname === href || pathname.startsWith(`${href}/`)) {
      if (!match || href.length > match.href.length) {
        match = entry;
      }
    }
  }
  return match;
}

export interface GroupIndexItem {
  href: string;
  label: string;
  description?: string;
  icon: LucideIcon;
}

/** Collects the visible pages of a group for its index page. */
export function groupIndexItems(group: RouteGroup): GroupIndexItem[] {
  return group.items
    .filter((entry): entry is RoutePage => entry.kind === "page")
    .map(({ href, label, description, icon }) => ({ href, label, description, icon }));
}
