"use client";

import { Badge as MantineBadge, type BadgeProps as MantineBadgeProps } from "@mantine/core";
import { forwardRef, type ComponentPropsWithoutRef } from "react";

export type BadgeProps = MantineBadgeProps & ComponentPropsWithoutRef<"div">;

/** Compact status/label badge with platform defaults. */
export const Badge = forwardRef<HTMLDivElement, BadgeProps>(
  ({ variant = "light", radius = "sm", ...props }, ref) => (
    <MantineBadge ref={ref} variant={variant} radius={radius} {...props} />
  ),
);

Badge.displayName = "Badge";
