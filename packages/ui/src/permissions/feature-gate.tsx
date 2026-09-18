"use client";

import type { FeatureKey } from "@cdorneles/permissions";
import type { ReactNode } from "react";

import { useAccess } from "./access-provider";

export interface FeatureGateProps {
  feature: FeatureKey;
  fallback?: ReactNode;
  children: ReactNode;
}

/**
 * Renders children only when the feature is enabled for the organization.
 * Feature enablement is independent of permissions (ADR-008).
 */
export function FeatureGate({ feature, fallback = null, children }: FeatureGateProps) {
  const access = useAccess();
  return <>{access.hasFeature(feature) ? children : fallback}</>;
}
