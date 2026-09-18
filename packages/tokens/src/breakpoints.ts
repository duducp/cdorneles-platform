/**
 * Canonical responsive breakpoints (ARCHITECTURE §14). Values are min-width
 * in pixels. `mantineBreakpoints` is the equivalent Mantine theme shape.
 */
export const breakpoints = {
  xs: 0,
  sm: 576,
  md: 768,
  lg: 1024,
  xl: 1280,
  xxl: 1536,
} as const;

export type Breakpoint = keyof typeof breakpoints;

export const breakpointNames = Object.keys(breakpoints) as Breakpoint[];

/** Breakpoints expressed as CSS `em` strings for Mantine. */
export const mantineBreakpoints = {
  xs: "0em",
  sm: "36em",
  md: "48em",
  lg: "64em",
  xl: "80em",
  xxl: "96em",
} as const;
