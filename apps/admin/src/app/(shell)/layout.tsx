"use client";

import { createShellLayout } from "@cdorneles/app";
import { LayoutDashboard, Settings, UserCog, Users } from "lucide-react";

export default createShellLayout({
  // The admin panel administers clients generally; it has no organization of
  // its own, so it must not be gated on /select-org.
  requireOrganization: false,
  navItems: [
    { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
    { label: "Clients", href: "/clients", icon: Users },
    { label: "Users", href: "/users", icon: UserCog },
    { label: "Settings", href: "/settings", icon: Settings },
  ],
});
