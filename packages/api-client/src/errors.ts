export interface ApiErrorOptions {
  code?: string;
  status?: number;
  cause?: unknown;
}

/** Normalized error shape for anything crossing the api-client boundary. */
export class ApiError extends Error {
  readonly code: string;
  readonly status?: number;

  constructor(message: string, options: ApiErrorOptions = {}) {
    super(message, { cause: options.cause });
    this.name = "ApiError";
    this.code = options.code ?? "unknown";
    this.status = options.status;
  }
}

export function isApiError(value: unknown): value is ApiError {
  return value instanceof ApiError;
}

/** Wraps unknown errors so callers only ever deal with `ApiError`. */
export function toApiError(error: unknown, fallbackCode = "unknown"): ApiError {
  if (isApiError(error)) {
    return error;
  }
  if (error instanceof Error) {
    return new ApiError(error.message, { code: fallbackCode, cause: error });
  }
  return new ApiError(String(error), { code: fallbackCode });
}

/** Appwrite codes that mean the session is gone, not that access was denied. */
const UNAUTHORIZED_CODES = new Set(["user_unauthorized", "general_unauthorized_scope"]);

/**
 * True when the error means the session is dead and the user must authenticate
 * again. A `403` is deliberately excluded: it is authorization, not identity,
 * and re-authenticating would not change the answer. A `user_more_factors_required`
 * 401 is also excluded: the session is alive, only the MFA gate is pending.
 */
export function isUnauthorized(error: unknown): boolean {
  if (!isApiError(error)) {
    return false;
  }
  if (error.code === "user_more_factors_required") {
    return false;
  }
  return error.status === 401 || UNAUTHORIZED_CODES.has(error.code);
}
