import path from "node:path";
import { fileURLToPath } from "node:url";

const currentDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(currentDir, "..");

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
  return {
    reactStrictMode: true,
    poweredByHeader: false,
    transpilePackages: sharedPackages,
    outputFileTracingRoot: repoRoot,
    experimental: {
      optimizePackageImports: ["@mantine/core", "@mantine/hooks", "lucide-react"],
    },
    ...overrides,
  };
}
