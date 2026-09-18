import { describe, expect, it } from "vitest";

import { breakpointNames, breakpoints, mantineBreakpoints } from "./breakpoints";
import {
  contrastRatio,
  createColorScale,
  hexToRgb,
  mixColors,
  readableTextColor,
  relativeLuminance,
} from "./color";

describe("breakpoints", () => {
  it("matches the architecture breakpoint scale", () => {
    expect(breakpoints).toEqual({ xs: 0, sm: 576, md: 768, lg: 1024, xl: 1280, xxl: 1536 });
  });

  it("keeps breakpoints monotonically increasing", () => {
    const values = breakpointNames.map((name) => breakpoints[name]);
    const sorted = [...values].sort((a, b) => a - b);
    expect(values).toEqual(sorted);
  });

  it("exposes a Mantine breakpoint for every token", () => {
    for (const name of breakpointNames) {
      expect(mantineBreakpoints[name]).toBeDefined();
    }
  });
});

describe("color utilities", () => {
  it("parses short and long hex values", () => {
    expect(hexToRgb("#fff")).toEqual({ r: 255, g: 255, b: 255 });
    expect(hexToRgb("#6366f1")).toEqual({ r: 99, g: 102, b: 241 });
    expect(hexToRgb("not-a-color")).toBeNull();
  });

  it("mixes colors toward the target", () => {
    expect(mixColors("#000000", "#ffffff", 1)).toBe("#ffffff");
    expect(mixColors("#000000", "#ffffff", 0)).toBe("#000000");
  });

  it("creates a 10-shade scale for valid colors", () => {
    const scale = createColorScale("#6366f1");
    expect(scale).toHaveLength(10);
    for (const shade of scale) {
      expect(hexToRgb(shade)).not.toBeNull();
    }
    expect(scale[5]).toBe("#6366f1");
  });

  it("falls back to a neutral scale for invalid colors", () => {
    const scale = createColorScale("nope");
    expect(scale).toHaveLength(10);
  });

  it("computes WCAG contrast extremes", () => {
    expect(contrastRatio("#000000", "#ffffff")).toBeCloseTo(21, 1);
    expect(relativeLuminance("#ffffff")).toBeCloseTo(1, 5);
    expect(relativeLuminance("#000000")).toBeCloseTo(0, 5);
  });

  it("picks readable text for light and dark backgrounds", () => {
    expect(readableTextColor("#ffffff")).toBe("#000000");
    expect(readableTextColor("#000000")).toBe("#ffffff");
  });
});
