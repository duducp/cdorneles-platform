"use client";

import { useEffect } from "react";
import { useTenant } from "@cdorneles/tenant";

export function OrgBranding() {
  const { branding } = useTenant();

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
