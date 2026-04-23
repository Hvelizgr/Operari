import { PrismaClient, Prisma } from '@prisma/client';
import { CustomError } from '../errors/custom-error';
import { logger } from '../config/logger.config';

/**
 * Persist an error to the database
 */
export async function persistExecutionError(
  prisma: PrismaClient,
  error: CustomError | Error,
  executionId: string,
  nodeLogId?: string
): Promise<void> {
  try {
    if (error instanceof CustomError) {
      await prisma.executionError.create({
        data: {
          executionId,
          nodeLogId,
          code: error.code,
          message: error.message,
          userMessage: error.userMessage,
          severity: error.severity.toUpperCase() as any, // Convert to uppercase for Prisma enum
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
      severity: severity.toUpperCase() as any,
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
      ...(severity && { severity: { in: severity.map(s => s.toUpperCase()) as any } }),
    },
    data: { notifiedAt: new Date() },
  });
}
