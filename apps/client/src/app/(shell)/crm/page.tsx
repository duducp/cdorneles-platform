import { GroupIndex, groupIndexItems, type RouteGroup } from "@cdorneles/ui/shell";
import Link from "next/link";

import { CLIENT_ROUTES } from "@cdorneles/app";

/**
 * The `/crm` group index (Django-admin style): lists the group's pages.
 * Permission filtering is a UX courtesy here; every child page gates itself.
 */
export default function CrmGroupIndexPage() {
  const group = CLIENT_ROUTES.find(
    (route): route is RouteGroup => route.kind === "group" && route.href === "/crm",
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
