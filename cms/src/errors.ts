import { Data, Match } from "effect";

// =============================================================================
// 1. Authentication Errors (HTTP 401/403)
// =============================================================================

export class InvalidCredentials extends Data.TaggedError("InvalidCredentials")<{
  readonly message?: string;
}> {}

export class SessionExpired extends Data.TaggedError("SessionExpired")<{
  readonly message?: string;
}> {}

export class InvalidApiKey extends Data.TaggedError("InvalidApiKey")<{
  readonly message?: string;
}> {}

export class Unauthorized extends Data.TaggedError("Unauthorized")<{
  readonly action: string;
  readonly resource?: string;
}> {
  get message(): string {
    return `User not authorized to perform ${this.action}${this.resource ? ` on ${this.resource}` : ""}`;
  }
}

// =============================================================================
// 2. Resource Errors (HTTP 400/404/409)
// =============================================================================

export class NotFound extends Data.TaggedError("NotFound")<{
  readonly resource: string;
  readonly id: string | number;
}> {
  get message(): string {
    return `${this.resource} with id ${this.id} not found`;
  }
}

export class SlugConflict extends Data.TaggedError("SlugConflict")<{
  readonly slug: string;
  readonly locale?: string;
}> {
  get message(): string {
    return `Slug '${this.slug}'${this.locale ? ` for locale '${this.locale}'` : ""} already exists`;
  }
}

export interface ValidationFieldError {
  readonly path: string;
  readonly message: string;
}

export class ValidationError extends Data.TaggedError("ValidationError")<{
  readonly errors: ReadonlyArray<ValidationFieldError>;
}> {
  get message(): string {
    return `Validation failed: ${this.errors.map((e) => `${e.path}: ${e.message}`).join(", ")}`;
  }
}

// =============================================================================
// 3. Infrastructure Errors (HTTP 500)
// =============================================================================

export class DatabaseError extends Data.TaggedError("DatabaseError")<{
  readonly cause: unknown;
  readonly operation: string;
}> {
  get message(): string {
    return `Database error during ${this.operation}`;
  }
}

export class StorageError extends Data.TaggedError("StorageError")<{
  readonly cause: unknown;
  readonly operation: string;
}> {
  get message(): string {
    return `Storage error during ${this.operation}`;
  }
}

export class ImageProcessingError extends Data.TaggedError("ImageProcessingError")<{
  readonly cause: unknown;
}> {
  get message(): string {
    return "Image processing failed";
  }
}

export class ConfigError extends Data.TaggedError("ConfigError")<{
  readonly message: string;
}> {}

// =============================================================================
// Type Unions
// =============================================================================

export type AuthError =
  | InvalidCredentials
  | SessionExpired
  | InvalidApiKey
  | Unauthorized;

export type ResourceError = NotFound | SlugConflict | ValidationError;

export type InfraError =
  | DatabaseError
  | StorageError
  | ImageProcessingError
  | ConfigError;

export type AppError = AuthError | ResourceError | InfraError;

// =============================================================================
// Response Interface
// =============================================================================

export interface ErrorResponse {
  readonly error: string;
  readonly message: string;
  readonly details?: unknown;
}

// =============================================================================
// Helpers
// =============================================================================

export const toHttpStatus = (error: AppError): number =>
  Match.value(error).pipe(
    Match.tags({
      InvalidCredentials: () => 401,
      SessionExpired: () => 401,
      InvalidApiKey: () => 401,
      Unauthorized: () => 403,
      NotFound: () => 404,
      SlugConflict: () => 409,
      ValidationError: () => 400,
      DatabaseError: () => 500,
      StorageError: () => 500,
      ImageProcessingError: () => 500,
      ConfigError: () => 500,
    }),
    Match.exhaustive
  );

export const toJsonResponse = (error: AppError): ErrorResponse => {
  const baseResponse = {
    error: error._tag,
    message: error.message,
  };

  // Add details for validation errors
  if (error._tag === "ValidationError") {
    return {
      ...baseResponse,
      details: error.errors,
    };
  }

  return baseResponse;
};

// =============================================================================
// Type Guards
// =============================================================================

export const isAuthError = (error: AppError): error is AuthError => {
  return (
    error._tag === "InvalidCredentials" ||
    error._tag === "SessionExpired" ||
    error._tag === "InvalidApiKey" ||
    error._tag === "Unauthorized"
  );
};

export const isResourceError = (error: AppError): error is ResourceError => {
  return (
    error._tag === "NotFound" ||
    error._tag === "SlugConflict" ||
    error._tag === "ValidationError"
  );
};

export const isInfraError = (error: AppError): error is InfraError => {
  return (
    error._tag === "DatabaseError" ||
    error._tag === "StorageError" ||
    error._tag === "ImageProcessingError" ||
    error._tag === "ConfigError"
  );
};

export const isAppError = (error: unknown): error is AppError => {
  return (
    typeof error === "object" &&
    error !== null &&
    "_tag" in error &&
    (isAuthError(error as AppError) ||
      isResourceError(error as AppError) ||
      isInfraError(error as AppError))
  );
};
