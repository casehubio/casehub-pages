export class ValidationError extends Error {
  readonly status = 422;
  readonly fieldErrors: Record<string, string[]>;

  constructor(fieldErrors: Record<string, string[]>, message?: string) {
    super(message ?? "Validation failed");
    this.name = "ValidationError";
    this.fieldErrors = fieldErrors;
  }
}

export class ConflictError extends Error {
  readonly status = 409;
  readonly currentVersion?: string | undefined;

  constructor(currentVersion?: string, message?: string) {
    super(message ?? "Version conflict");
    this.name = "ConflictError";
    this.currentVersion = currentVersion;
  }
}
