"use client";

import { Button as MantineButton, type ButtonProps as MantineButtonProps } from "@mantine/core";
import { forwardRef, type ComponentPropsWithoutRef } from "react";

export type ButtonVariant = "primary" | "secondary" | "subtle" | "danger";

const VARIANT_MAP: Record<ButtonVariant, Pick<MantineButtonProps, "variant" | "color">> = {
  primary: { variant: "filled", color: "brand" },
  secondary: { variant: "default" },
  subtle: { variant: "subtle", color: "brand" },
  danger: { variant: "filled", color: "danger" },
};

export type ButtonProps = Omit<MantineButtonProps, "variant" | "color"> &
  Omit<ComponentPropsWithoutRef<"button">, "color"> & {
    variant?: ButtonVariant;
  };

/** Platform button: semantic variants mapped to Mantine, token-driven radius. */
export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ variant = "primary", radius = "md", ...props }, ref) => (
    <MantineButton ref={ref} radius={radius} {...VARIANT_MAP[variant]} {...props} />
  ),
);

Button.displayName = "Button";
