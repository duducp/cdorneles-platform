/** Placeholder origin used only to run the URL parser; never navigated to. */
const BASE = "https://internal.invalid";

/**
 * Resolves the post-authentication destination from a URL query string.
 *
 * The middleware redirects unauthenticated users to `/login?redirect=<path>`,
 * and that value is attacker-controllable. Rather than pattern-matching the
 * raw string (which misses `/\evil.test`, `/%5Cevil.test` and `/%09/evil.test`
 * — all of which the browser URL parser resolves cross-origin), parse it
 * against a fixed origin and accept only values that stay on that origin.
 * Anything that escapes — an absolute URL, a protocol-relative `//host`, a
 * backslash or stripped control character — falls back to `/`.
 *
 * Kept pure (a search string in, a path out) so it can be tested without a
 * browser, and so callers can pass `window.location.search` at submit time
 * instead of pulling the page behind a Suspense boundary.
 */
export function resolvePostAuthRedirect(search: string): string {
  const value = new URLSearchParams(search).get("redirect");

  if (!value) return "/";

  try {
    const url = new URL(value, BASE);
    if (url.origin !== BASE) return "/";
    const out = `${url.pathname}${url.search}${url.hash}`;
    // The parser collapses `.`/`..` segments after fixing the host, so a rooted
    // input can still surface as `//host`, which Next resolves cross-origin.
    if (!out.startsWith("/") || out.startsWith("//")) return "/";
    return out;
  } catch {
    return "/";
  }
}
