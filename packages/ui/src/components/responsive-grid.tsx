"use client";

import { SimpleGrid, type SimpleGridProps } from "@mantine/core";
import { forwardRef, type ComponentPropsWithoutRef } from "react";

export type ResponsiveColumns =
  | number
  | {
      base?: number;
      xs?: number;
      sm?: number;
      md?: number;
      lg?: number;
      xl?: number;
    };

export type ResponsiveGridProps = Omit<SimpleGridProps, "cols"> &
  ComponentPropsWithoutRef<"div"> & {
    columns?: ResponsiveColumns;
  };

/**
 * Responsive grid built on Mantine's SimpleGrid. Defaults progress from one
 * column on mobile to four on large desktop.
 */
export const ResponsiveGrid = forwardRef<HTMLDivElement, ResponsiveGridProps>(
  ({ columns = { base: 1, sm: 2, md: 3, lg: 4 }, spacing = "md", ...props }, ref) => (
    <SimpleGrid ref={ref} cols={columns} spacing={spacing} {...props} />
  ),
);

ResponsiveGrid.displayName = "ResponsiveGrid";
