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

  it("keeps the query string and hash of the target path", () => {
    expect(resolvePostAuthRedirect("?redirect=%2Fcustomers%3Fpage%3D2")).toBe("/customers?page=2");
    expect(resolvePostAuthRedirect("?redirect=%2Fa%3Fb%3Dc%23d")).toBe("/a?b=c#d");
  });

  it("rejects an absolute URL", () => {
    expect(resolvePostAuthRedirect("?redirect=https%3A%2F%2Fevil.test")).toBe("/");
    expect(resolvePostAuthRedirect("?redirect=https%3A%2F%2Fevil.test%2Fx")).toBe("/");
  });

  it("rejects a protocol-relative URL", () => {
    expect(resolvePostAuthRedirect("?redirect=%2F%2Fevil.test")).toBe("/");
    expect(resolvePostAuthRedirect("?redirect=%2F%2F%2Fevil.test")).toBe("/");
  });

  it("rejects a backslash that the URL parser treats as a host separator", () => {
    expect(resolvePostAuthRedirect("?redirect=%2F%5Cevil.test")).toBe("/");
    expect(resolvePostAuthRedirect("?redirect=/%5Cevil.test")).toBe("/");
  });

  it("rejects a tab that the URL parser strips into a protocol-relative URL", () => {
    expect(resolvePostAuthRedirect("?redirect=%2F%09%2Fevil.test")).toBe("/");
  });

  it("canonicalises a relative path against the fixed origin", () => {
    expect(resolvePostAuthRedirect("?redirect=dashboard")).toBe("/dashboard");
  });
});
