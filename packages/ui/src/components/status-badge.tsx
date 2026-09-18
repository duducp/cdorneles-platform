"use client";

import { Badge, type BadgeProps } from "./badge";

export const STATUS_VALUES = [
  "neutral",
  "info",
  "success",
  "warning",
  "danger",
  "pending",
  "active",
  "inactive",
  "suspended",
  "archived",
] as const;

export type StatusValue = (typeof STATUS_VALUES)[number];

interface StatusConfig {
  color: string;
  label: string;
}

const STATUS_CONFIG: Record<StatusValue, StatusConfig> = {
  neutral: { color: "gray", label: "Neutral" },
  info: { color: "info", label: "Info" },
  success: { color: "success", label: "Success" },
  warning: { color: "warning", label: "Warning" },
  danger: { color: "danger", label: "Error" },
  pending: { color: "warning", label: "Pending" },
  active: { color: "success", label: "Active" },
  inactive: { color: "gray", label: "Inactive" },
  suspended: { color: "danger", label: "Suspended" },
  archived: { color: "gray", label: "Archived" },
};

export interface StatusBadgeProps extends Omit<BadgeProps, "color" | "children"> {
  status: StatusValue;
  /** Overrides the default human-readable label. */
  label?: string;
}

export function getStatusConfig(status: StatusValue): StatusConfig {
  return STATUS_CONFIG[status];
}

/** Semantic status pill backed by the platform status vocabulary. */
export function StatusBadge({ status, label, ...props }: StatusBadgeProps) {
  const config = STATUS_CONFIG[status];
  return (
    <Badge color={config.color} {...props}>
      {label ?? config.label}
    </Badge>
  );
}
