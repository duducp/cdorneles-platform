import { describe, expect, it } from "vitest";

import { APPLICATION_IDS, isApplicationId } from "./application";
import { isThemeMode } from "./theme";

describe("application registry", () => {
  it("exposes exactly the two platform applications", () => {
    expect(APPLICATION_IDS).toEqual(["admin", "client"]);
  });

  it("guards application ids", () => {
    expect(isApplicationId("admin")).toBe(true);
    expect(isApplicationId("orders")).toBe(false);
    expect(isApplicationId(undefined)).toBe(false);
  });
});

describe("theme mode guard", () => {
  it("accepts only light and dark", () => {
    expect(isThemeMode("light")).toBe(true);
    expect(isThemeMode("dark")).toBe(true);
    expect(isThemeMode("system")).toBe(false);
  });
});
