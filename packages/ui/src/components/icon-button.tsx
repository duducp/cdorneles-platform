"use client";

import { ActionIcon, type ActionIconProps } from "@mantine/core";
import { forwardRef, type ComponentPropsWithoutRef, type ComponentType } from "react";

/** Icon component accepted by `IconButton` — a Lucide icon or a custom composite. */
export type IconButtonIcon = ComponentType<{ size?: number; "aria-hidden"?: boolean }>;

export type IconButtonProps = Omit<ActionIconProps, "children"> &
  Omit<ComponentPropsWithoutRef<"button">, "color"> & {
    /** Icon component (Lucide icon or a custom composite). */
    icon: IconButtonIcon;
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
