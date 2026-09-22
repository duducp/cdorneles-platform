import { type NextRequest, NextResponse } from "next/server";

const SESSION_COOKIE = "cdorneles-session";

const protectedPaths = ["/dashboard", "/clients", "/settings", "/billing"];

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
  matcher: ["/dashboard/:path*", "/clients/:path*", "/settings/:path*", "/billing/:path*"],
};
