import { describe, expect, it } from "vitest";

import { forgotPasswordSchema, loginSchema, mfaChallengeSchema, resetPasswordSchema } from "./auth";

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

describe("forgotPasswordSchema", () => {
  it("accepts a valid e-mail", () => {
    expect(forgotPasswordSchema.safeParse({ email: "user@example.com" }).success).toBe(true);
  });

  it("rejects an invalid e-mail", () => {
    expect(forgotPasswordSchema.safeParse({ email: "nope" }).success).toBe(false);
  });
});

describe("resetPasswordSchema", () => {
  it("accepts a password of at least 8 characters with a matching confirmation", () => {
    const result = resetPasswordSchema.safeParse({
      password: "s3cret-pass",
      passwordConfirmation: "s3cret-pass",
    });
    expect(result.success).toBe(true);
  });

  it("rejects a short password", () => {
    const result = resetPasswordSchema.safeParse({
      password: "short",
      passwordConfirmation: "short",
    });
    expect(result.success).toBe(false);
  });

  it("rejects a mismatched confirmation on the confirmation field", () => {
    const result = resetPasswordSchema.safeParse({
      password: "s3cret-pass",
      passwordConfirmation: "other-pass",
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.path).toEqual(["passwordConfirmation"]);
    }
  });
});

describe("mfaChallengeSchema", () => {
  it("accepts exactly six digits", () => {
    expect(mfaChallengeSchema.safeParse({ code: "123456" }).success).toBe(true);
  });

  it("rejects five digits", () => {
    expect(mfaChallengeSchema.safeParse({ code: "12345" }).success).toBe(false);
  });

  it("rejects non-digits", () => {
    expect(mfaChallengeSchema.safeParse({ code: "12a456" }).success).toBe(false);
  });
});
