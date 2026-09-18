import { describe, expect, it } from "vitest";

import {
  createAccessChecker,
  hasAllPermissions,
  hasAnyPermission,
  hasPermission,
  resolveEffectiveAccess,
} from "./access";
import { featureKey, isFeatureKey } from "./feature-key";
import { isPermissionKey, parsePermissionKey, permissionKey } from "./permission-key";

describe("permission keys", () => {
  it("accepts resource.action keys", () => {
    expect(isPermissionKey("customers.read")).toBe(true);
    expect(isPermissionKey("invoices.approve")).toBe(true);
  });

  it("rejects malformed keys", () => {
    expect(isPermissionKey("customers")).toBe(false);
    expect(isPermissionKey("Customers.Read")).toBe(false);
    expect(isPermissionKey("customers.")).toBe(false);
    expect(parsePermissionKey("bad")).toBeNull();
  });

  it("throws when constructing an invalid key", () => {
    expect(permissionKey("orders.create")).toBe("orders.create");
    expect(() => permissionKey("nope")).toThrow();
  });
});

describe("feature keys", () => {
  it("accepts snake/dot keys", () => {
    expect(isFeatureKey("advanced_reporting")).toBe(true);
    expect(isFeatureKey("billing.invoices")).toBe(true);
    expect(isFeatureKey("Advanced")).toBe(false);
  });

  it("creates branded feature keys", () => {
    const key = featureKey("advanced_reporting");
    expect(key).toBe("advanced_reporting");
    expect(() => featureKey("Bad Key")).toThrow();
  });
});

describe("effective access", () => {
  const allGranted = {
    authenticated: true,
    membership: true,
    organizationActive: true,
    applicationAccess: true,
    permission: true,
    featureEnabled: true,
  };

  it("requires every layer", () => {
    expect(resolveEffectiveAccess(allGranted)).toBe(true);
    for (const key of Object.keys(allGranted) as (keyof typeof allGranted)[]) {
      expect(resolveEffectiveAccess({ ...allGranted, [key]: false })).toBe(false);
    }
  });
});

describe("access checker", () => {
  const checker = createAccessChecker({
    permissions: [permissionKey("customers.read"), permissionKey("customers.update")],
    features: [featureKey("advanced_reporting")],
  });

  it("is deny-by-default", () => {
    expect(checker.hasPermission(permissionKey("customers.read"))).toBe(true);
    expect(checker.hasPermission(permissionKey("customers.delete"))).toBe(false);
  });

  it("supports any/all checks", () => {
    expect(hasPermission([permissionKey("orders.read")], permissionKey("orders.read"))).toBe(true);
    expect(
      hasAnyPermission(
        [permissionKey("orders.read")],
        [permissionKey("orders.read"), permissionKey("orders.create")],
      ),
    ).toBe(true);
    expect(
      hasAllPermissions(
        [permissionKey("orders.read")],
        [permissionKey("orders.read"), permissionKey("orders.create")],
      ),
    ).toBe(false);
  });

  it("checks features independently of permissions", () => {
    expect(checker.hasFeature(featureKey("advanced_reporting"))).toBe(true);
    expect(checker.hasFeature(featureKey("experimental_ai"))).toBe(false);
  });
});
