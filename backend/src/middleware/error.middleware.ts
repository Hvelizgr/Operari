import { NextFunction, Request, Response } from 'express';

import { logger } from '../config/logger.config';
import { CustomError, ErrorCode, ErrorSeverity } from '../errors/custom-error';

/**
 * Global express error handler.
 *
 * Catches anything that escapes a route handler and turns it into a
 * well-formed JSON response. The handler is chain-aware:
 *
 * 1. `CustomError` (and its subclasses — NodeExecutionError, HttpError,
 *    WorkflowError, …) → the class's own `statusCode` getter picks the
 *    HTTP status via the ERROR_CODE_TO_HTTP table. Body comes from
 *    `toResponse()` — a stable shape of { code, message, userMessage }.
 * 2. Any `Error` with a numeric `statusCode` on it → use that status
 *    (supports third-party middleware conventions) with the error's
 *    message.
 * 3. Everything else → 500 with a generic body so we never leak an
 *    internal stack to the client. Full error is logged with request
 *    context for server-side debugging.
 *
 * The old `AppError` class this module used to export was killed off
 * in favor of CustomError — it had zero instantiations and zero
 * `instanceof` checks outside this file.
 */
export const errorHandler = (err: unknown, req: Request, res: Response, _next: NextFunction) => {
  if (err instanceof CustomError) {
    // High/critical errors log at error level; everything else at
    // warn so noisy-but-expected errors (quota, validation) don't
    // drown out real incidents in the aggregator.
    const level =
      err.severity === ErrorSeverity.CRITICAL || err.severity === ErrorSeverity.HIGH
        ? 'error'
        : 'warn';
    logger[level](
      { err, path: req.path, method: req.method, code: err.code },
      `Request failed: ${err.code}`
    );
    return res.status(err.statusCode).json(err.toResponse());
  }

  // Third-party middleware sometimes attaches a numeric statusCode
  // onto a plain Error (express-jwt, zod-express, …). Honor it with
  // a minimal body so those paths don't fall through to the generic 500.
  if (err instanceof Error && typeof (err as { statusCode?: unknown }).statusCode === 'number') {
    const statusCode = (err as unknown as { statusCode: number }).statusCode;
    logger.warn(
      { err, path: req.path, method: req.method, statusCode },
      `Request failed with ${statusCode}`
    );
    return res.status(statusCode).json({
      code: ErrorCode.UNKNOWN_ERROR,
      message: err.message,
      userMessage: err.message,
    });
  }

  logger.error({ err, path: req.path, method: req.method }, 'Unhandled error');
  return res.status(500).json({
    code: ErrorCode.UNKNOWN_ERROR,
    message: 'Internal server error',
    userMessage: 'An unexpected error occurred. Please try again later.',
  });
};
