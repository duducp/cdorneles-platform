"use client";

import { createShellLayout } from "@cdorneles/app";
import { LayoutDashboard } from "lucide-react";

export default createShellLayout({
  navItems: [{ label: "Dashboard", href: "/dashboard", icon: LayoutDashboard }],
});
