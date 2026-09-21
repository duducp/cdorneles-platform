"use client";

import { useContext, useEffect } from "react";
import { TenantContext } from "@cdorneles/tenant";

/**
 * Injects the active organization's favicon into the document head.
 * Render once in the root layout. Silently no-ops if TenantProvider
 * is not in the tree (e.g. during SSR/static rendering).
 */
export function OrgBranding() {
  const context = useContext(TenantContext);
  const branding = context?.branding ?? null;

  useEffect(() => {
    if (!branding?.favicon) return;

    const link = document.querySelector(
      "link[rel~='icon']",
    ) as HTMLLinkElement | null;
    if (link) {
      link.href = branding.favicon;
    } else {
      const newLink = document.createElement("link");
      newLink.rel = "icon";
      newLink.href = branding.favicon;
      document.head.appendChild(newLink);
    }
  }, [branding?.favicon]);

  useEffect(() => {
    if (branding?.displayName) {
      document.title = branding.displayName;
    }
  }, [branding?.displayName]);

  return null;
}
