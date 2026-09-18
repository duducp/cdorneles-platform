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
