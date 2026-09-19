export interface ProvisioningEnv {
  endpoint: string;
  projectId: string;
  apiKey: string;
}

/**
 * Resolves the Appwrite connection settings for provisioning.
 *
 * The endpoint and project ID may come from either the server-side names
 * (`APPWRITE_*`) or the public ones the apps share (`NEXT_PUBLIC_APPWRITE_*`),
 * since the repository `.env` defines the latter. The API key is always
 * server-side only.
 */
export function resolveProvisioningEnv(
  env: Record<string, string | undefined>,
): ProvisioningEnv | null {
  const endpoint = env.APPWRITE_ENDPOINT ?? env.NEXT_PUBLIC_APPWRITE_ENDPOINT;
  const projectId = env.APPWRITE_PROJECT_ID ?? env.NEXT_PUBLIC_APPWRITE_PROJECT_ID;
  const apiKey = env.APPWRITE_API_KEY;

  if (!endpoint || !projectId || !apiKey) {
    return null;
  }

  return { endpoint, projectId, apiKey };
}
