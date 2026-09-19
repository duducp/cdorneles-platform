import { describe, expect, it } from "vitest";

import { loginSchema } from "./auth";

describe("loginSchema", () => {
  it("accepts a valid e-mail and password", () => {
    expect(loginSchema.safeParse({ email: "user@example.com", password: "secret" }).success).toBe(
      true,
    );
  });

  it("rejects an invalid e-mail", () => {
    const result = loginSchema.safeParse({ email: "nope", password: "secret" });
    expect(result.success).toBe(false);
  });

  it("rejects an empty password", () => {
    const result = loginSchema.safeParse({ email: "user@example.com", password: "" });
    expect(result.success).toBe(false);
  });
});
