import { expect, it } from "vitest";

import { isGoogleAuthEnabled } from "./google-auth-enabled";

it("only an explicit false disables Google auth", () => {
  expect(isGoogleAuthEnabled("false")).toBe(false);
  expect(isGoogleAuthEnabled(" FALSE ")).toBe(false);
});

it("enables Google auth for unset or any other value", () => {
  expect(isGoogleAuthEnabled(undefined)).toBe(true);
  expect(isGoogleAuthEnabled("")).toBe(true);
  expect(isGoogleAuthEnabled("true")).toBe(true);
  expect(isGoogleAuthEnabled("no")).toBe(true);
});
