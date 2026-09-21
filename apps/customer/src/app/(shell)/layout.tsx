"use client";

import { AppShell, Sidebar, Topbar } from "@cdorneles/ui/shell";
import { useAuth } from "@cdorneles/auth";
import { OrgGuard, useTenant } from "@cdorneles/tenant";
import { useRouter, usePathname } from "next/navigation";
import { useCallback, useState } from "react";
import { LayoutDashboard } from "lucide-react";

const NAV_ITEMS = [
  { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
];

export default function ShellLayout({ children }: { children: React.ReactNode }) {
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
    <OrgGuard onRedirectToSelectOrg={handleRedirectToSelectOrg}>
      <AppShell
        sidebar={
          <Sidebar
            items={NAV_ITEMS}
            activeHref={pathname}
            collapsed={!opened}
          />
        }
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
}
