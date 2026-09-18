/**
 * Public (browser-safe) runtime configuration. Never read secrets here.
 * Each value is referenced statically so Next can inline it at build time.
 */
export interface PublicEnv {
  appwriteEndpoint: string;
  appwriteProjectId: string;
  sentryDsn: string;
}

export function readPublicEnv(): PublicEnv {
  return {
    appwriteEndpoint: process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT ?? "",
    appwriteProjectId: process.env.NEXT_PUBLIC_APPWRITE_PROJECT_ID ?? "",
    sentryDsn: process.env.NEXT_PUBLIC_SENTRY_DSN ?? "",
  };
}

export const APP_ID = "admin" as const;
