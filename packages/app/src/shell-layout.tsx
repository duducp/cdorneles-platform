"use client";

import { useAuth } from "@cdorneles/auth";
import { permissionKey } from "@cdorneles/permissions";
import { OrgGuard, useTenant } from "@cdorneles/tenant";
import { LoadingScreen, Logo } from "@cdorneles/ui";
import { AppShell, OrgSwitcher, Sidebar, Topbar, type SidebarNavItem } from "@cdorneles/ui/shell";
import { useAccess } from "@cdorneles/ui/permissions";

import { NavPendingIndicator } from "./nav-pending";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useCallback, useState, type ReactNode } from "react";

/** A sidebar entry: the label, its route and its icon. */
export type ShellNavItem = SidebarNavItem;

export interface CreateShellLayoutOptions {
  /** Navigation entries for this application. */
  navItems: ShellNavItem[];
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
 * content area.
 *
 * OrgGuard lives here rather than in the providers so it only gates the
 * protected routes. Mounted at the root it would also gate /login, /mfa and
 * the recovery screens, which must render for an anonymous visitor.
 */
export function createShellLayout({
  navItems,
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
