"use client";

import { Button as MantineButton, type ButtonProps as MantineButtonProps } from "@mantine/core";
import { forwardRef } from "react";

export type ButtonVariant = "primary" | "secondary" | "subtle" | "danger";

const VARIANT_MAP: Record<ButtonVariant, Pick<MantineButtonProps, "variant" | "color">> = {
  primary: { variant: "filled", color: "brand" },
  secondary: { variant: "default" },
  subtle: { variant: "subtle", color: "brand" },
  danger: { variant: "filled", color: "danger" },
};

export type ButtonProps = Omit<
  MantineButtonProps,
  "variant" | "color" | "component" | "href" | "onClick" | "disabled" | "type" | "loading"
> & {
  variant?: ButtonVariant;
  type?: "button" | "submit" | "reset";
  disabled?: boolean;
  loading?: boolean;
  onClick?: React.MouseEventHandler<HTMLButtonElement>;
  /**
   * Target URL when rendering as a link (`component` set). Next apps pass
   * `next/link` and give the destination here.
   */
  href?: string;
  /**
   * Anchor element for link-buttons; Next apps pass `next/link`. Typed as
   * `any` on purpose: Mantine 9's polymorphic generic cannot distribute a
   * union `ElementType` through this wrapper (the same escape hatch Mantine
   * uses in `PlaceholderPolymorphicProps`).
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  component?: any;
};

/** Platform button: semantic variants mapped to Mantine, token-driven radius. */
export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ variant = "primary", radius = "md", ...props }, ref) => (
    <MantineButton ref={ref} radius={radius} {...VARIANT_MAP[variant]} {...props} />
  ),
);

Button.displayName = "Button";
