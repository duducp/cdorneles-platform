"use client";

import { Card as MantineCard, type CardProps as MantineCardProps } from "@mantine/core";
import { forwardRef, type ComponentPropsWithoutRef } from "react";

export type CardProps = MantineCardProps & ComponentPropsWithoutRef<"div">;

/** Surface container with the platform's default border/shadow/radius. */
export const Card = forwardRef<HTMLDivElement, CardProps>(
  ({ withBorder = true, shadow = "xs", radius = "md", padding = "lg", ...props }, ref) => (
    <MantineCard
      ref={ref}
      withBorder={withBorder}
      shadow={shadow}
      radius={radius}
      padding={padding}
      {...props}
    />
  ),
);

Card.displayName = "Card";
