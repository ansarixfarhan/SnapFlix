import type { MobileErrorCode } from "./types";

/**
 * An error whose `message` is safe to return to mobile clients. Internal TMDB
 * URLs, request parameters and credentials are never included.
 */
export class MobileError extends Error {
  readonly code: MobileErrorCode;
  readonly status: number;
  readonly retryable: boolean;
  readonly retryAfterSeconds: number | null;

  constructor(
    code: MobileErrorCode,
    status: number,
    message: string,
    options: {
      retryable?: boolean;
      retryAfterSeconds?: number | null;
      cause?: unknown;
    } = {},
  ) {
    super(message, options.cause === undefined ? undefined : { cause: options.cause });
    this.name = "MobileError";
    this.code = code;
    this.status = status;
    this.retryable = options.retryable ?? false;
    this.retryAfterSeconds = options.retryAfterSeconds ?? null;
  }
}

export const badRequestError = (): MobileError =>
  new MobileError("bad_request", 400, "The request contains invalid or unsupported parameters.");

export const clientUnauthorizedError = (): MobileError =>
  new MobileError("client_unauthorized", 401, "A valid mobile API credential is required.");

export const serviceUnconfiguredError = (): MobileError =>
  new MobileError(
    "service_unconfigured",
    503,
    "The mobile metadata service is not configured on the server.",
  );

export const internalError = (): MobileError =>
  new MobileError("internal_error", 500, "The mobile metadata service could not complete the request.");
