import { describe, expect, it } from "vitest";

import { organizationNameSchema } from "./organization";

describe("organizationNameSchema", () => {
  it("accepts a valid name", () => {
    expect(organizationNameSchema.parse("Acme Ltda")).toBe("Acme Ltda");
  });

  it("trims surrounding whitespace", () => {
    expect(organizationNameSchema.parse("  Acme  ")).toBe("Acme");
  });

  it("rejects an empty name", () => {
    expect(() => organizationNameSchema.parse("   ")).toThrow();
  });

  it("rejects names longer than 128 characters", () => {
    expect(() => organizationNameSchema.parse("a".repeat(129))).toThrow();
  });
});
