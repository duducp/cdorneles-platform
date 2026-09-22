import { describe, expect, it } from "vitest";

import { ApiError, isUnauthorized } from "./errors";

describe("isUnauthorized", () => {
  it("accepts a 401", () => {
    expect(isUnauthorized(new ApiError("no", { status: 401 }))).toBe(true);
  });

  it("accepts the Appwrite codes for a dead session", () => {
    expect(isUnauthorized(new ApiError("no", { code: "user_unauthorized" }))).toBe(true);
    expect(isUnauthorized(new ApiError("no", { code: "general_unauthorized_scope" }))).toBe(true);
  });

  it("rejects a 403 — that is authorization, not identity", () => {
    expect(isUnauthorized(new ApiError("no", { status: 403 }))).toBe(false);
  });

  it("rejects anything that is not an ApiError", () => {
    expect(isUnauthorized(new Error("boom"))).toBe(false);
    expect(isUnauthorized("401")).toBe(false);
    expect(isUnauthorized(undefined)).toBe(false);
  });
});
