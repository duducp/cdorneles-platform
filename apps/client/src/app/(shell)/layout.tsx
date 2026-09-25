"use client";

import { createShellLayout } from "@cdorneles/app";
import { LayoutDashboard, Settings, Users } from "lucide-react";

export default createShellLayout({
  // The client app is org-scoped: show the topbar organization switcher.
  organizationSwitcher: true,
  navItems: [
    { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
    { label: "Customers", href: "/customers", icon: Users },
    { label: "Settings", href: "/settings", icon: Settings },
  ],
});
