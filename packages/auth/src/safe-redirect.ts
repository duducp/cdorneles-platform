/**
 * Resolves the post-authentication destination from a URL query string.
 *
 * The middleware redirects unauthenticated users to `/login?redirect=<path>`,
 * and that value is attacker-controllable, so only same-site absolute paths are
 * accepted. Anything else — an absolute URL, a protocol-relative `//host`, or
 * nothing at all — falls back to `/`.
 *
 * Kept pure (a search string in, a path out) so it can be tested without a
 * browser, and so callers can pass `window.location.search` at submit time
 * instead of pulling the page behind a Suspense boundary.
 */
export function resolvePostAuthRedirect(search: string): string {
  const value = new URLSearchParams(search).get("redirect");

  if (!value || !value.startsWith("/") || value.startsWith("//")) {
    return "/";
  }

  return value;
}
