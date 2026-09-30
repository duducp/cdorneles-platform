import { NextRequest } from "next/server";
import { describe, expect, it } from "vitest";

import { config, proxy } from "./proxy";

function request(path: string, withCookie = false): NextRequest {
  return new NextRequest(`http://localhost${path}`, {
    headers: withCookie ? { cookie: "cdorneles-session=1" } : {},
  });
}

describe("proxy", () => {
  it("redirects an unauthenticated portal request to /login", () => {
    const response = proxy(request("/p/crm/customers"));

    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe(
      "http://localhost/login?redirect=%2Fp%2Fcrm%2Fcustomers",
    );
  });

  it("lets an authenticated portal request through", () => {
    const response = proxy(request("/p/crm/customers", true));

    expect(response.status).toBe(200);
    expect(response.headers.get("location")).toBeNull();
  });

  it("protects the bare portal root too", () => {
    const response = proxy(request("/p"));

    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe("http://localhost/login?redirect=%2Fp");
  });

  it("stays out of the public routes", () => {
    const response = proxy(request("/login"));

    expect(response.status).toBe(200);
    expect(response.headers.get("location")).toBeNull();
  });

  it("keeps the matcher covering the portal subtree", () => {
    // Next only invokes proxy for paths the matcher covers, so a protected
    // path missing here silently bypasses the whole gate.
    expect(config.matcher).toContain("/p/:path*");
  });
});
