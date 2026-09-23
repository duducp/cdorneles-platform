import { afterEach, expect, it, vi } from "vitest";

import { isGoogleAuthEnabled } from "./google-auth-enabled";

afterEach(() => {
  vi.unstubAllEnvs();
});

it("only an explicit false disables Google auth", () => {
  expect(isGoogleAuthEnabled("false")).toBe(false);
  expect(isGoogleAuthEnabled(" FALSE ")).toBe(false);
});

it("enables Google auth for any other explicit value", () => {
  expect(isGoogleAuthEnabled("")).toBe(true);
  expect(isGoogleAuthEnabled("true")).toBe(true);
  expect(isGoogleAuthEnabled("no")).toBe(true);
});

it("enables Google auth when the environment variable is unset", () => {
  vi.stubEnv("NEXT_PUBLIC_GOOGLE_AUTH_ENABLED", "");

  expect(isGoogleAuthEnabled()).toBe(true);
});
