"use client";

import { useAuth } from "@cdorneles/auth";
import { OrgGuard, useTenant } from "@cdorneles/tenant";
import { LoadingState } from "@cdorneles/ui";
import { AppShell, Sidebar, Topbar, type SidebarNavItem } from "@cdorneles/ui/shell";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useCallback, useState, type ReactNode } from "react";

/** A sidebar entry: the label, its route and its icon. */
export type ShellNavItem = SidebarNavItem;

export interface CreateShellLayoutOptions {
  /** Navigation entries for this application. */
  navItems: ShellNavItem[];
}

/**
 * Builds the authenticated shell layout: sidebar, topbar and the guarded
 * content area.
 *
 * OrgGuard lives here rather than in the providers so it only gates the
 * protected routes. Mounted at the root it would also gate /login, /mfa and
 * the recovery screens, which must render for an anonymous visitor.
 */
export function createShellLayout({ navItems }: CreateShellLayoutOptions) {
  return function ShellLayout({ children }: { children: ReactNode }) {
    const router = useRouter();
    const pathname = usePathname();
    const { user, logout } = useAuth();
    const { currentOrganization } = useTenant();
    const [opened, setOpened] = useState(true);

    const handleLogout = useCallback(async () => {
      await logout();
      router.push("/login");
    }, [logout, router]);

    const handleRedirectToSelectOrg = useCallback(() => {
      router.replace("/select-org");
    }, [router]);

    return (
      <OrgGuard
        onRedirectToSelectOrg={handleRedirectToSelectOrg}
        fallback={<LoadingState label="Carregando…" />}
      >
        <AppShell
          sidebar={<Sidebar
            items={navItems}
            activeHref={pathname}
            collapsed={!opened}
            linkComponent={Link}
          />}
          topbar={
            <Topbar
              userName={currentOrganization?.name ?? user?.name ?? "User"}
              userEmail={user?.email}
              sidebarOpened={opened}
              onToggleSidebar={() => setOpened((o) => !o)}
              onLogout={handleLogout}
            />
          }
        >
          {children}
        </AppShell>
      </OrgGuard>
    );
  };
}
