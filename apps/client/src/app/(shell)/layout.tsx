"use client";

import { createShellLayout } from "@cdorneles/app";
import { LayoutDashboard, Settings } from "lucide-react";

export default createShellLayout({
  navItems: [
    { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
    { label: "Settings", href: "/settings", icon: Settings },
  ],
});
