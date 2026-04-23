import { $Enums, Prisma, PrismaClient } from '@prisma/client';

import { logger } from '../config/logger.config';
import { CustomError } from '../errors/custom-error';

/**
 * Coerce a lower/mixed-case severity string (usually from the
 * in-memory `ErrorSeverity` enum, whose values are lowercase) to the
 * uppercase variant Prisma's `ErrorSeverity` enum demands. Keeps the
 * inevitable string→enum cast in one place instead of scattering
 * `as any` across every call site.
 */
export const toPrismaErrorSeverity = (severity: string): $Enums.ErrorSeverity =>
  severity.toUpperCase() as $Enums.ErrorSeverity;

/**
 * Persist an error to the database.
 *
 * `tenantId` is required so the row can be scoped without a join back
 * through Execution — callers already have it in scope (it comes from
 * the request context or the parent Runbook). Never look it up here.
 */
export async function persistExecutionError(
  prisma: PrismaClient,
  error: CustomError | Error,
  executionId: string,
  tenantId: string,
  nodeLogId?: string
): Promise<void> {
  try {
    if (error instanceof CustomError) {
      await prisma.executionError.create({
        data: {
          executionId,
          tenantId,
          nodeLogId,
          code: error.code,
          message: error.message,
          userMessage: error.userMessage,
          severity: toPrismaErrorSeverity(error.severity),
          isRetryable: error.isRetryable,
          retryCount: error.context.retryCount ?? 0,
          maxRetries: error.context.maxRetries ?? 0,
          context: error.context as unknown as Prisma.InputJsonValue,
          stackTrace: error.stack,
          cause: error.cause
            ? {
                name: error.cause.name,
                message: error.cause.message,
                stack: error.cause.stack,
              }
            : undefined,
        },
      });
    } else {
      // Generic error not wrapped in CustomError
      await prisma.executionError.create({
        data: {
          executionId,
          tenantId,
          nodeLogId,
          code: 'ERR_1000', // UNKNOWN_ERROR
          message: error.message,
          userMessage: 'An unexpected error occurred. Please try again later.',
          severity: 'HIGH', // Default to HIGH for unknown errors
          isRetryable: false,
          retryCount: 0,
          maxRetries: 0,
          stackTrace: error.stack,
        },
      });
    }
  } catch (persistError) {
    // Log persistence failure but don't throw to avoid double errors
    logger.error({ err: persistError, executionId }, 'Failed to persist execution error');
  }
}

/**
 * Get all errors for an execution
 */
export async function getExecutionErrors(prisma: PrismaClient, executionId: string) {
  return prisma.executionError.findMany({
    where: { executionId },
    orderBy: { createdAt: 'asc' },
  });
}

/**
 * Get errors by severity level
 */
export async function getErrorsBySeverity(
  prisma: PrismaClient,
  executionId: string,
  severity: string
) {
  return prisma.executionError.findMany({
    where: {
      executionId,
      severity: toPrismaErrorSeverity(severity),
    },
    orderBy: { createdAt: 'desc' },
  });
}

/**
 * Get critical errors that need notification
 */
export async function getCriticalErrors(prisma: PrismaClient, executionId: string) {
  return prisma.executionError.findMany({
    where: {
      executionId,
      severity: { in: ['HIGH', 'CRITICAL'] },
      notifiedAt: null, // Not yet notified
    },
    orderBy: { createdAt: 'asc' },
  });
}

/**
 * Mark error as notified
 */
export async function markErrorAsNotified(prisma: PrismaClient, errorId: string): Promise<void> {
  await prisma.executionError.update({
    where: { id: errorId },
    data: { notifiedAt: new Date() },
  });
}

/**
 * Mark errors as notified by execution
 */
export async function markErrorsAsNotified(
  prisma: PrismaClient,
  executionId: string,
  severity?: string[]
): Promise<void> {
  await prisma.executionError.updateMany({
    where: {
      executionId,
      ...(severity && { severity: { in: severity.map(toPrismaErrorSeverity) } }),
    },
    data: { notifiedAt: new Date() },
  });
}
