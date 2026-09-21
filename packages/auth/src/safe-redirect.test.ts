import { describe, expect, it } from "vitest";

import { resolvePostAuthRedirect } from "./safe-redirect";

describe("resolvePostAuthRedirect", () => {
  it("falls back to the root without a redirect param", () => {
    expect(resolvePostAuthRedirect("")).toBe("/");
    expect(resolvePostAuthRedirect("?other=1")).toBe("/");
  });

  it("keeps a same-site path", () => {
    expect(resolvePostAuthRedirect("?redirect=%2Fdashboard")).toBe("/dashboard");
    expect(resolvePostAuthRedirect("?redirect=/settings/billing")).toBe("/settings/billing");
  });

  it("keeps the query string of the target path", () => {
    expect(resolvePostAuthRedirect("?redirect=%2Fcustomers%3Fpage%3D2")).toBe(
      "/customers?page=2",
    );
  });

  it("rejects an absolute URL", () => {
    expect(resolvePostAuthRedirect("?redirect=https%3A%2F%2Fevil.test")).toBe("/");
  });

  it("rejects a protocol-relative URL", () => {
    expect(resolvePostAuthRedirect("?redirect=%2F%2Fevil.test")).toBe("/");
  });

  it("rejects a relative path that does not start at the root", () => {
    expect(resolvePostAuthRedirect("?redirect=dashboard")).toBe("/");
  });
});
