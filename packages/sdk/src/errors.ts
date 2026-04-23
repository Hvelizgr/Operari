export class CairnError extends Error {
  constructor(
    message: string,
    public readonly statusCode?: number,
    public readonly code?: string,
    public readonly details?: unknown
  ) {
    super(message);
    this.name = 'CairnError';
  }
}

export class CairnAuthError extends CairnError {
  constructor(message = 'Invalid or missing API key') {
    super(message, 401, 'unauthorized');
    this.name = 'CairnAuthError';
  }
}

export class CairnNotFoundError extends CairnError {
  constructor(resource: string) {
    super(`${resource} not found`, 404, 'not_found');
    this.name = 'CairnNotFoundError';
  }
}

export class CairnTimeoutError extends CairnError {
  constructor(message = 'Operation timed out') {
    super(message, 408, 'timeout');
    this.name = 'CairnTimeoutError';
  }
}
