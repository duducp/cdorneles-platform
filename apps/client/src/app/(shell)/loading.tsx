import { LoadingScreen } from "@cdorneles/ui";

/**
 * Shown while a protected route segment is being fetched. With static pages
 * that Next has prefetched this rarely appears; it earns its keep once the
 * pages load data on the server.
 */
export default function Loading() {
  return <LoadingScreen />;
}
