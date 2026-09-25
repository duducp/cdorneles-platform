"use client";

import { createShellLayout, CLIENT_ROUTES } from "@cdorneles/app";

export default createShellLayout({
  routes: CLIENT_ROUTES,
  organizationSwitcher: true,
});
