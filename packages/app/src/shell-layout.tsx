"use client";

import { useAuth } from "@cdorneles/auth";
import { permissionKey } from "@cdorneles/permissions";
import { OrgGuard, useTenant } from "@cdorneles/tenant";
import { LoadingScreen, Logo } from "@cdorneles/ui";
import {
  AppShell,
  deriveTrail,
  NavigationProgress,
  OrgSwitcher,
  Sidebar,
  Topbar,
  type RouteEntry,
  type SidebarNavItem,
} from "@cdorneles/ui/shell";
import { useAccess } from "@cdorneles/ui/permissions";

import { NavPendingIndicator } from "./nav-pending";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useCallback, useMemo, useState, type ReactNode } from "react";

/** A sidebar entry: the label, its route and its icon. */
export type ShellNavItem = SidebarNavItem;

/** Flattens the registry into sidebar entries with section titles. */
function toNavItems(entries: readonly RouteEntry[]): SidebarNavItem[] {
  const items: SidebarNavItem[] = [];
  for (const entry of entries) {
    if (entry.kind === "page") {
      items.push({ label: entry.label, href: entry.href, icon: entry.icon });
      continue;
    }
    // A group holding a single visible page renders as that page; deeper
    // nesting stays flat for now (the registry is one group level deep).
    if (entry.items.length === 1 && entry.items[0]!.kind === "page") {
      const page = entry.items[0]!;
      items.push({ label: page.label, href: page.href, icon: page.icon });
      continue;
    }
    items.push({ label: entry.label, href: entry.href, icon: entry.icon });
    for (const child of entry.items) {
      if (child.kind === "page") {
        items.push({
          label: child.label,
          href: child.href,
          icon: child.icon,
          section: entry.label,
        });
      }
    }
  }
  return items;
}

export interface CreateShellLayoutOptions {
  /** The app's route registry (groups, pages, labels, permissions). */
  routes: readonly RouteEntry[];
  /**
   * Gate the shell on an active organization. The client app is org-scoped; the
   * admin panel administers clients generally and needs no organization of its
   * own. Defaults to `true`.
   */
  requireOrganization?: boolean;
  /**
   * Show the organization switcher in the topbar. Only meaningful on
   * org-scoped apps where the user may belong to several organizations;
   * defaults to `false` (the admin panel does not switch organizations).
   */
  organizationSwitcher?: boolean;
}

/**
 * Builds the authenticated shell layout: sidebar, topbar and the guarded
 * content area. Navigation, breadcrumbs and group indexes all derive from the
 * shared route registry.
 *
 * OrgGuard lives here rather than in the providers so it only gates the
 * protected routes. Mounted at the root it would also gate /login, /mfa and
 * the recovery screens, which must render for an anonymous visitor.
 */
export function createShellLayout({
  routes,
  requireOrganization = true,
  organizationSwitcher = false,
}: CreateShellLayoutOptions) {
  return function ShellLayout({ children }: { children: ReactNode }) {
    const router = useRouter();
    const pathname = usePathname();
    const { user, logout } = useAuth();
    const { currentOrganization, organizations, ready, switchOrganization, createOrganization } =
      useTenant();
    const [opened, setOpened] = useState(true);
    const access = useAccess();
    const canCreateOrganizations = access.hasPermission(permissionKey("organizations.create"));

    // Sidebar entries and the breadcrumb trail derive from the registry.
    // `routes` is a module constant, so it is not a hook dependency.
    const navItems = useMemo(() => toNavItems(routes), []);
    const breadcrumbTrail = useMemo(
      () => deriveTrail(pathname, navItems, routes),
      [pathname, navItems],
    );
    const handleLogout = useCallback(async () => {
      await logout();
      router.push("/login");
    }, [logout, router]);

    const handleRedirectToSelectOrg = useCallback(() => {
      router.replace("/select-org");
    }, [router]);

    const handleSwitchOrganization = useCallback(
      (organizationId: string) => {
        // Membership is re-checked inside switchOrganization; an unknown id is
        // a no-op rather than a navigation.
        switchOrganization(organizationId);
      },
      [switchOrganization],
    );

    const handleCreateOrganization = useCallback(
      async (name: string) => {
        await createOrganization(name);
      },
      [createOrganization],
    );

    const shell = (
      <NavigationProgress>
        <AppShell
          sidebar={
            <Sidebar
              items={navItems}
              activeHref={pathname}
              collapsed={!opened}
              linkComponent={Link}
              pendingComponent={NavPendingIndicator}
            />
          }
          topbar={
            <Topbar
              logo={<Logo variant="symbol" alt={currentOrganization?.name ?? "Logo"} height={32} />}
              leftSection={
                organizationSwitcher ? (
                  <OrgSwitcher
                    organizations={organizations}
                    currentOrganizationId={currentOrganization?.id}
                    onSelect={handleSwitchOrganization}
                    canCreate={canCreateOrganizations}
                    onCreateOrganization={handleCreateOrganization}
                    loading={!ready}
                  />
                ) : undefined
              }
              breadcrumbTrail={breadcrumbTrail}
              breadcrumbLinkComponent={Link}
              userName={user?.name ?? "User"}
              userEmail={user?.email}
              sidebarOpened={opened}
              onToggleSidebar={() => setOpened((o) => !o)}
              onLogout={handleLogout}
            />
          }
        >
          {children}
        </AppShell>
      </NavigationProgress>
    );

    if (!requireOrganization) {
      return shell;
    }

    return (
      <OrgGuard onRedirectToSelectOrg={handleRedirectToSelectOrg} fallback={<LoadingScreen />}>
        {shell}
      </OrgGuard>
    );
  };
}
