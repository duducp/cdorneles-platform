"use client";

import { createShellLayout } from "@cdorneles/app";
import { LayoutDashboard, Settings, Users } from "lucide-react";

export default createShellLayout({
  // The client app is org-scoped: show the topbar organization switcher.
  organizationSwitcher: true,
  navItems: [
    { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard, section: "General" },
    { label: "Customers", href: "/customers", icon: Users, section: "General" },
    { label: "Settings", href: "/settings", icon: Settings, section: "Configuration" },
  ],
});
