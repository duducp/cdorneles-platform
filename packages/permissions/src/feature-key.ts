declare const featureKeyBrand: unique symbol;

/**
 * Features are globally defined, organization-enabled capabilities (ADR-008).
 * A branded type keeps them from being confused with permission keys.
 */
export type FeatureKey = string & { readonly [featureKeyBrand]: true };

const FEATURE_PATTERN = /^[a-z][a-z0-9_]*(\.[a-z][a-z0-9_]*)?$/;

export function isFeatureKey(value: unknown): value is FeatureKey {
  return typeof value === "string" && FEATURE_PATTERN.test(value);
}

export function parseFeatureKey(value: string): FeatureKey | null {
  return isFeatureKey(value) ? value : null;
}

export function featureKey(value: string): FeatureKey {
  if (!isFeatureKey(value)) {
    throw new Error(`Invalid feature key: "${value}"`);
  }
  return value;
}
