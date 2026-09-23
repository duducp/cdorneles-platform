/**
 * Whether Google auth is enabled for this build.
 *
 * It is a kill switch: only an explicit "false" (any casing, surrounding
 * spaces ignored) turns it off, so an unset or malformed value never disables
 * Google by accident. In production the value comes from an Appwrite project
 * variable, shared with every site and the one-tap-login function.
 */
export function isGoogleAuthEnabled(
  value = process.env.NEXT_PUBLIC_GOOGLE_AUTH_ENABLED,
): boolean {
  return (value ?? "").trim().toLowerCase() !== "false";
}
