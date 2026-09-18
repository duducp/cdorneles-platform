/**
 * Global application registry (ADR-004 / ARCHITECTURE §8).
 * Applications are a platform-level concept, not a business module.
 */
export const APPLICATION_IDS = ["admin", "client", "customer"] as const;

export type ApplicationId = (typeof APPLICATION_IDS)[number];

export function isApplicationId(value: unknown): value is ApplicationId {
  return typeof value === "string" && (APPLICATION_IDS as readonly string[]).includes(value);
}
