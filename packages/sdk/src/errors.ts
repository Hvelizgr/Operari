export class OperariError extends Error {
  constructor(
    message: string,
    public readonly statusCode?: number,
    public readonly code?: string,
    public readonly details?: unknown
  ) {
    super(message);
    this.name = 'OperariError';
  }
}

export class OperariAuthError extends OperariError {
  constructor(message = 'Invalid or missing API key') {
    super(message, 401, 'unauthorized');
    this.name = 'OperariAuthError';
  }
}

export class OperariNotFoundError extends OperariError {
  constructor(resource: string) {
    super(`${resource} not found`, 404, 'not_found');
    this.name = 'OperariNotFoundError';
  }
}

export class OperariTimeoutError extends OperariError {
  constructor(message = 'Operation timed out') {
    super(message, 408, 'timeout');
    this.name = 'OperariTimeoutError';
  }
}
