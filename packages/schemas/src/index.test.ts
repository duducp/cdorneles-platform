import { describe, expect, it } from "vitest";

import { brandingSchema } from "./branding";
import { hexColorSchema } from "./color";
import { applicationIdSchema, themeModeSchema } from "./platform";

describe("platform schemas", () => {
  it("accepts known applications and rejects unknown ones", () => {
    expect(applicationIdSchema.safeParse("admin").success).toBe(true);
    expect(applicationIdSchema.safeParse("orders").success).toBe(false);
  });

  it("accepts only light/dark themes", () => {
    expect(themeModeSchema.safeParse("dark").success).toBe(true);
    expect(themeModeSchema.safeParse("system").success).toBe(false);
  });

  it("validates hex colors", () => {
    expect(hexColorSchema.safeParse("#fff").success).toBe(true);
    expect(hexColorSchema.safeParse("#6366f1").success).toBe(true);
    expect(hexColorSchema.safeParse("indigo").success).toBe(false);
  });
});

describe("branding schema", () => {
  it("requires a display name and a default theme", () => {
    const result = brandingSchema.safeParse({ displayName: "Acme", defaultTheme: "light" });
    expect(result.success).toBe(true);
  });

  it("rejects invalid colors", () => {
    const result = brandingSchema.safeParse({
      displayName: "Acme",
      defaultTheme: "light",
      primaryColor: "blue",
    });
    expect(result.success).toBe(false);
  });
});
