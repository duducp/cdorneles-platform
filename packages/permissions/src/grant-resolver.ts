import type { FunctionsApi } from "@cdorneles/api-client";

import type { GrantedAccess } from "./access";
import type { FeatureKey } from "./feature-key";
import type { PermissionKey } from "./permission-key";

const RESOLVE_GRANTS_FUNCTION_ID = "resolve-grants";

export interface GrantResolverInput {
  userId: string;
  organizationId: string;
  applicationId: string;
}

interface GrantResponse {
  permissions?: string[];
  features?: string[];
  error?: string;
  reason?: string;
}

/**
 * Calls the resolve-grants Appwrite Function to fetch the user's effective
 * permissions and features for the given organization and application.
 */
export async function resolveGrants(
  functionsApi: FunctionsApi,
  input: GrantResolverInput,
): Promise<GrantedAccess> {
  const execution = await functionsApi.createExecution({
    functionId: RESOLVE_GRANTS_FUNCTION_ID,
    body: JSON.stringify(input),
    method: "POST",
  });

  const data: GrantResponse = JSON.parse(execution.responseBody);

  if (data.error) {
    throw new Error(`resolve-grants failed: ${data.reason ?? data.error}`);
  }

  return {
    permissions: (data.permissions ?? []) as PermissionKey[],
    features: (data.features ?? []) as FeatureKey[],
  };
}
