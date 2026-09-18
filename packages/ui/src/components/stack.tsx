"use client";

import { Stack as MantineStack, type StackProps as MantineStackProps } from "@mantine/core";
import { forwardRef, type ComponentPropsWithoutRef } from "react";

export type StackProps = MantineStackProps & ComponentPropsWithoutRef<"div">;

/** Vertical layout with the platform's default rhythm. */
export const Stack = forwardRef<HTMLDivElement, StackProps>(({ gap = "md", ...props }, ref) => (
  <MantineStack ref={ref} gap={gap} {...props} />
));

Stack.displayName = "Stack";
