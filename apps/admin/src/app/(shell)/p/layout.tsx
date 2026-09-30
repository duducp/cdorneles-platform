"use client";

import { createShellLayout, ADMIN_ROUTES } from "@cdorneles/app";

export default createShellLayout({
  // The admin panel administers clients generally; it has no organization of
  // its own, so it must not be gated on /select-org.
  requireOrganization: false,
  routes: ADMIN_ROUTES,
  organizationSwitcher: false,
});
