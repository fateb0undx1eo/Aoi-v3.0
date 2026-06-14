export class ExternalServiceUnavailableError extends Error {
  public override name = 'ExternalServiceUnavailableError';
  public cause: Error | null;

  constructor(message: string, cause: Error | null = null) {
    super(message);
    this.cause = cause;
  }
}

export class ValidationError extends Error {
  public override name = 'ValidationError';
  public cause: Error | null;

  constructor(message: string, cause: Error | null = null) {
    super(message);
    this.cause = cause;
  }
}

export class UnauthorizedError extends Error {
  public override name = 'UnauthorizedError';
  public cause: Error | null;

  constructor(message: string, cause: Error | null = null) {
    super(message);
    this.cause = cause;
  }
}
