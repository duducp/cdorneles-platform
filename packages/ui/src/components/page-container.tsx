"use client";

import { Container, type ContainerProps } from "@mantine/core";
import { forwardRef, type ComponentPropsWithoutRef } from "react";

export type PageContainerSize = "sm" | "md" | "lg" | "xl" | "full";

const SIZE_MAP: Record<PageContainerSize, number | string> = {
  sm: 640,
  md: 960,
  lg: 1200,
  xl: 1440,
  full: "100%",
};

export type PageContainerProps = Omit<ContainerProps, "size"> &
  ComponentPropsWithoutRef<"div"> & {
    size?: PageContainerSize;
  };

/** Responsive page wrapper providing consistent gutters and max width. */
export const PageContainer = forwardRef<HTMLDivElement, PageContainerProps>(
  ({ size = "xl", px, ...props }, ref) => (
    <Container ref={ref} size={SIZE_MAP[size]} px={px ?? { base: "md", md: "xl" }} {...props} />
  ),
);

PageContainer.displayName = "PageContainer";
