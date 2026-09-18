"use client";

import { ActionIcon, type ActionIconProps } from "@mantine/core";
import type { LucideIcon } from "lucide-react";
import { forwardRef, type ComponentPropsWithoutRef } from "react";

export type IconButtonProps = Omit<ActionIconProps, "children"> &
  Omit<ComponentPropsWithoutRef<"button">, "color"> & {
    /** Lucide icon component. */
    icon: LucideIcon;
    /** Accessible name. Required because the button has no visible text. */
    label: string;
    iconSize?: number;
  };

export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(
  ({ icon: Icon, label, iconSize = 18, variant = "subtle", radius = "md", ...props }, ref) => (
    <ActionIcon
      ref={ref}
      variant={variant}
      radius={radius}
      aria-label={label}
      title={label}
      {...props}
    >
      <Icon size={iconSize} aria-hidden />
    </ActionIcon>
  ),
);

IconButton.displayName = "IconButton";
