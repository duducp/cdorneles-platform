/**
 * Loads project `.env` values into the Appwrite MCP server environment.
 *
 * opencode's `{env:VAR}` substitution reads only the process environment, not
 * `.env` files, so this plugin bridges the two: `.env` stays the single source
 * of truth for the apps and for the MCP server.
 */

import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

interface LocalMcpServer {
  type: string;
  command?: string[];
  environment?: Record<string, string>;
}

interface OpenCodeConfigShape {
  mcp?: Record<string, LocalMcpServer>;
}

function parseEnvFile(content: string): Record<string, string> {
  const values: Record<string, string> = {};

  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) {
      continue;
    }

    const separator = line.indexOf("=");
    if (separator === -1) {
      continue;
    }

    const key = line.slice(0, separator).trim();
    let value = line.slice(separator + 1).trim();

    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    if (key) {
      values[key] = value;
    }
  }

  return values;
}

export default async ({ directory }: { directory: string }) => {
  return {
    config: (config: OpenCodeConfigShape) => {
      try {
        const envPath = join(directory, ".env");
        if (!existsSync(envPath)) {
          return;
        }

        const env = parseEnvFile(readFileSync(envPath, "utf8"));

        const mcp = (config.mcp ??= {});
        const appwrite = (mcp.appwrite ??= {
          type: "local",
          command: ["uvx", "mcp-server-appwrite"],
        });

        if (appwrite.type !== "local") {
          return;
        }

        const environment = { ...(appwrite.environment ?? {}) };

        if (env.NEXT_PUBLIC_APPWRITE_ENDPOINT) {
          environment.APPWRITE_ENDPOINT = env.NEXT_PUBLIC_APPWRITE_ENDPOINT;
        }
        if (env.NEXT_PUBLIC_APPWRITE_PROJECT_ID) {
          environment.APPWRITE_PROJECT_ID = env.NEXT_PUBLIC_APPWRITE_PROJECT_ID;
        }
        if (env.APPWRITE_API_KEY) {
          environment.APPWRITE_API_KEY = env.APPWRITE_API_KEY;
        }

        appwrite.environment = environment;
      } catch {
        // Never break opencode startup because of environment loading.
      }
    },
  };
};
