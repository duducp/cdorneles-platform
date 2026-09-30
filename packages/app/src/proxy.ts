import { type NextRequest, NextResponse } from "next/server";

import { PORTAL_PREFIX } from "./portal";

const SESSION_COOKIE = "cdorneles-session";

/**
 * Every authenticated route lives under the portal prefix (`/p`), so the gate
 * is a single subtree. Anything outside it is public by construction.
 */
const protectedPaths = [PORTAL_PREFIX];

function matchesProtected(pathname: string): boolean {
  return protectedPaths.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (!matchesProtected(pathname)) {
    return NextResponse.next();
  }

  const hasSession = request.cookies.get(SESSION_COOKIE)?.value === "1";

  if (hasSession) {
    return NextResponse.next();
  }

  const loginUrl = new URL("/login", request.url);
  loginUrl.searchParams.set("redirect", pathname);
  return NextResponse.redirect(loginUrl);
}

export const config = {
  matcher: ["/p/:path*"],
};
