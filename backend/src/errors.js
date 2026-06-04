export class ExternalServiceUnavailableError extends Error {
  constructor(message, cause = null) {
    super(message);
    this.name = 'ExternalServiceUnavailableError';
    this.cause = cause;
  }
}

export class ValidationError extends Error {
  constructor(message, cause = null) {
    super(message);
    this.name = 'ValidationError';
    this.cause = cause;
  }
}

export class UnauthorizedError extends Error {
  constructor(message, cause = null) {
    super(message);
    this.name = 'UnauthorizedError';
    this.cause = cause;
  }
}
