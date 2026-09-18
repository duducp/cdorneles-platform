import { ApiError } from "./errors";

/** Connection settings for the Appwrite backend. */
export interface ApiClientConfig {
  endpoint: string;
  projectId: string;
}

export interface ApiClientConfigInput {
  endpoint?: string | null;
  projectId?: string | null;
}

/**
 * Validates and normalizes Appwrite connection settings.
 *
 * The foundation intentionally does not ship real endpoints/project ids:
 * they are supplied through environment variables per application.
 */
export function resolveApiClientConfig(input: ApiClientConfigInput): ApiClientConfig {
  const endpoint = input.endpoint?.trim();
  const projectId = input.projectId?.trim();

  if (!endpoint) {
    throw new ApiError("Missing Appwrite endpoint.", { code: "invalid_config" });
  }
  if (!projectId) {
    throw new ApiError("Missing Appwrite project id.", { code: "invalid_config" });
  }

  return { endpoint, projectId };
}
