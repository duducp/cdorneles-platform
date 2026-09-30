export { proxy } from "@cdorneles/app/proxy";

/**
 * Routes that require a session. Declared here rather than re-exported because
 * Next.js statically analyses this field and rejects a re-export — and because
 * which routes are protected is this application's own surface.
 *
 * The whole signed-in surface lives under `/p` (private/portal), so one
 * subtree covers it.
 */
export const config = {
  matcher: ["/p/:path*"],
};
