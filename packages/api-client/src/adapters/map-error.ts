import { AppwriteException } from "appwrite";

import { ApiError, toApiError } from "../errors";

/**
 * Normalizes any error crossing the Appwrite SDK boundary to an `ApiError`.
 * The Appwrite error `type` (e.g. `user_unauthorized`) becomes the stable code
 * and the HTTP status is preserved for callers that need it.
 */
export function mapAppwriteError(error: unknown): ApiError {
  if (error instanceof AppwriteException) {
    return new ApiError(error.message, {
      code: error.type || "appwrite",
      status: error.code || undefined,
      cause: error,
    });
  }
  return toApiError(error);
}
