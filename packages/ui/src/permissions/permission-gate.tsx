"use client";

import type { PermissionKey } from "@cdorneles/permissions";
import type { ReactNode } from "react";

import { useAccess } from "./access-provider";

export interface PermissionGateProps {
  permission: PermissionKey | readonly PermissionKey[];
  /** Whether every permission (`all`) or at least one (`any`) is required. */
  mode?: "all" | "any";
  fallback?: ReactNode;
  children: ReactNode;
}

/**
 * Renders children only when the current capabilities allow it. UX only —
 * never a security boundary.
 */
export function PermissionGate({
  permission,
  mode = "all",
  fallback = null,
  children,
}: PermissionGateProps) {
  const access = useAccess();
  const required = typeof permission === "string" ? [permission] : permission;
  const allowed =
    mode === "all" ? access.hasAllPermissions(required) : access.hasAnyPermission(required);

  return <>{allowed ? children : fallback}</>;
}
