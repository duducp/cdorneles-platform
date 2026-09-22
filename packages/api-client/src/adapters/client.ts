import { Client } from "appwrite";

import type { ApiClientConfig } from "../config";

/**
 * Locale sent as the `X-Appwrite-Locale` header on every request. Appwrite
 * picks its built-in email templates (recovery, verification, invites) from
 * this value, so Brazilian Portuguese users get Portuguese emails.
 */
export const APPWRITE_LOCALE = "pt-br";

/**
 * Creates the single Appwrite Web SDK client used by every service adapter.
 * Called from `createAppwriteServices`, never at module top level, so importing
 * the package has no side effects.
 */
export function createAppwriteClient(config: ApiClientConfig): Client {
  return new Client()
    .setEndpoint(config.endpoint)
    .setProject(config.projectId)
    .setLocale(APPWRITE_LOCALE);
}
