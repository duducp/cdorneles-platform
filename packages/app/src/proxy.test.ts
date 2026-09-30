import { NextRequest } from "next/server";
import { describe, expect, it } from "vitest";

import { config, proxy } from "./proxy";

function request(path: string, withCookie = false): NextRequest {
  return new NextRequest(`http://localhost${path}`, {
    headers: withCookie ? { cookie: "cdorneles-session=1" } : {},
  });
}

describe("proxy", () => {
  it("redirects an unauthenticated /crm request to /login", () => {
    const response = proxy(request("/crm/customers"));

    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe(
      "http://localhost/login?redirect=%2Fcrm%2Fcustomers",
    );
  });

  it("lets an authenticated /crm request through", () => {
    const response = proxy(request("/crm/customers", true));

    expect(response.status).toBe(200);
    expect(response.headers.get("location")).toBeNull();
  });

  it("still redirects unauthenticated /dashboard requests", () => {
    const response = proxy(request("/dashboard"));

    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe("http://localhost/login?redirect=%2Fdashboard");
  });

  it("keeps the matcher in sync with the protected paths", () => {
    // Next only invokes proxy for paths the matcher covers, so a protected
    // path missing here silently bypasses the whole gate.
    expect(config.matcher).toContain("/crm/:path*");
  });
});
