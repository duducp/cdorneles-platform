import { describe, expect, it } from "vitest";

import { brand, dark, gray, semanticColors } from "./colors";

describe("brand palette", () => {
  it("pins the primary shade to CDorneles Orange", () => {
    expect(brand[5]).toBe("#f45d22");
  });

  it("exposes ten shades", () => {
    expect(brand).toHaveLength(10);
  });
});

describe("neutral palettes", () => {
  it("anchors the gray scale on the guide fundamentals", () => {
    expect(gray[5]).toBe("#737373");
    expect(gray[9]).toBe("#171717");
  });

  it("maps the dark surfaces to the GitHub Primer values", () => {
    // Canvas (7), raised surface (6), control (5) and border (4), straight
    // from `@primer/primitives` dark.css.
    expect(dark[7]).toBe("#0d1117");
    expect(dark[6]).toBe("#151b23");
    expect(dark[5]).toBe("#212830");
    expect(dark[4]).toBe("#3d444d");
  });

  it("keeps the light canvas distinct from the white surface", () => {
    expect(semanticColors.light.background).toBe("#fafafa");
    expect(semanticColors.light.surface).toBe("#ffffff");
  });
});
