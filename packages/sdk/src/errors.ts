export class NanoRunError extends Error {
  constructor(
    message: string,
    public readonly statusCode?: number,
    public readonly code?: string,
    public readonly details?: unknown
  ) {
    super(message);
    this.name = 'NanoRunError';
  }
}

export class NanoRunAuthError extends NanoRunError {
  constructor(message = 'Invalid or missing API key') {
    super(message, 401, 'unauthorized');
    this.name = 'NanoRunAuthError';
  }
}

export class NanoRunNotFoundError extends NanoRunError {
  constructor(resource: string) {
    super(`${resource} not found`, 404, 'not_found');
    this.name = 'NanoRunNotFoundError';
  }
}

export class NanoRunTimeoutError extends NanoRunError {
  constructor(message = 'Operation timed out') {
    super(message, 408, 'timeout');
    this.name = 'NanoRunTimeoutError';
  }
}
