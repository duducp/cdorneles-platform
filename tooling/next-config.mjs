import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const currentDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(currentDir, "..");

/**
 * The root package version, bumped by release-please, is the single source of
 * truth for "what is deployed". Next inlines `NEXT_PUBLIC_*` at build time, so
 * baking it in here means the value travels with the bundle and needs no
 * Appwrite variable to be configured per site.
 */
const appVersion = JSON.parse(readFileSync(path.join(repoRoot, "package.json"), "utf8")).version;

/**
 * Every shared package is consumed as TypeScript source, so Next.js must
 * transpile them. Keep this list in sync with `packages/*`.
 */
export const sharedPackages = [
  "@cdorneles/api-client",
  "@cdorneles/auth",
  "@cdorneles/observability",
  "@cdorneles/permissions",
  "@cdorneles/schemas",
  "@cdorneles/tenant",
  "@cdorneles/theme",
  "@cdorneles/tokens",
  "@cdorneles/types",
  "@cdorneles/ui",
];

/**
 * Shared Next.js configuration factory. Applications only pass what is
 * genuinely app-specific, keeping the base consistent across the monorepo.
 */
export function createNextConfig(overrides = {}) {
  const { env: overrideEnv, ...rest } = overrides;

  return {
    reactStrictMode: true,
    poweredByHeader: false,
    transpilePackages: sharedPackages,
    outputFileTracingRoot: repoRoot,
    // Standalone output is what Appwrite Sites' SSR runner expects. In a
    // monorepo it nests the server under .next/standalone/apps/<app>/server.js;
    // scripts/build-appwrite-site.mjs restructures it to the layout Appwrite
    // looks for.
    output: "standalone",
    env: {
      NEXT_PUBLIC_APP_VERSION: appVersion,
      ...overrideEnv,
    },
    experimental: {
      optimizePackageImports: ["@mantine/core", "@mantine/hooks", "lucide-react"],
    },
    ...rest,
  };
}
