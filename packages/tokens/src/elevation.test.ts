import { describe, expect, it } from "vitest";

import { elevation, elevationShadows, mantineShadows } from "./elevation";

describe("elevation", () => {
  it("keeps the shadow tokens as scheme-aware variable references", () => {
    expect(elevation.none).toBe("none");
    expect(elevation.xs).toBe("var(--cd-shadow-xs)");
    expect(elevation.sm).toBe("var(--cd-shadow-sm)");
    expect(elevation.md).toBe("var(--cd-shadow-md)");
    expect(elevation.lg).toBe("var(--cd-shadow-lg)");
  });

  it("maps every Mantine shadow onto the elevation scale", () => {
    expect(mantineShadows.xs).toBe(elevation.xs);
    expect(mantineShadows.sm).toBe(elevation.sm);
    expect(mantineShadows.md).toBe(elevation.md);
    expect(mantineShadows.lg).toBe(elevation.lg);
    expect(mantineShadows.xl).toBe(elevation.lg);
  });

  it("keeps light casts on the slate ink", () => {
    expect(elevationShadows.light.xs).toContain("rgba(15, 23, 42");
  });

  it("anchors dark casts on GitHub's near-black Primer ink", () => {
    for (const value of Object.values(elevationShadows.dark)) {
      expect(value).toContain("rgba(1, 4, 9");
    }
  });

  it("exposes a cast for every elevation token", () => {
    for (const key of Object.keys(elevation)) {
      if (key === "none") continue;
      expect(elevationShadows.light).toHaveProperty(key);
      expect(elevationShadows.dark).toHaveProperty(key);
    }
  });
});
