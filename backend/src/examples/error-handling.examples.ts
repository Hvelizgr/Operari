/**
 * Error Handling System - Examples
 *
 * This file demonstrates how to use the robust error handling system
 * implemented in the backend.
 */

// ============================================================================
// EXAMPLE 1: Handling HTTP Requests with Automatic Retry
// ============================================================================

import { withHttpRetry } from '@/utils/retry';

async function fetchUserDataWithRetry() {
  try {
    const user = await withHttpRetry(
      async () => {
        const response = await fetch('https://api.example.com/users/123');
        return response.json();
      },
      'Fetch User from External API',
      {
        maxRetries: 3,
        initialDelay: 1000, // Start at 1 second
        maxDelay: 10000, // Cap at 10 seconds
        backoffMultiplier: 2, // Double each attempt
      }
    );
    console.log('User data:', user);
  } catch (error) {
    console.error('Failed to fetch user after retries:', error);
    // Error is already a CustomError with context
  }
}

// ============================================================================
// EXAMPLE 2: Creating Custom Errors with Context
// ============================================================================

import { CustomError, ErrorCode, ErrorSeverity } from '@/errors/custom-error';

function validateWorkflow(workflow: any) {
  if (!workflow.name) {
    throw new CustomError({
      message: 'Workflow name is required',
      code: ErrorCode.VALIDATION_ERROR,
      severity: ErrorSeverity.MEDIUM,
      userMessage: 'Please provide a workflow name',
      context: {
        workflowId: workflow.id,
        userId: 'current-user-id',
      },
    });
  }
}

// ============================================================================
// EXAMPLE 3: Handling Node Execution Errors
// ============================================================================

import { ErrorCode, NodeExecutionError } from '@/errors/custom-error';

async function executeNode(node: any, input: any) {
  try {
    // Node execution logic
    return await someNodeOperation(node, input);
  } catch (error) {
    throw new NodeExecutionError({
      message: `Node ${node.id} failed: ${error.message}`,
      code: ErrorCode.NODE_EXECUTION_FAILED,
      nodeId: node.id,
      nodeName: node.title,
      nodeType: node.type,
      context: {
        executionId: 'exec-123',
        workflowId: 'wf-456',
      },
      isRetryable: true, // This node can be retried
      cause: error,
    });
  }
}

// ============================================================================
// EXAMPLE 4: HTTP Requests with Error Handling
// ============================================================================

import { ErrorCode, HttpError } from '@/errors/custom-error';
import { withHttpRetry } from '@/utils/retry';

async function makeHttpRequest(config: any, input: any) {
  try {
    const result = await withHttpRetry(
      async () => {
        const response = await fetch(config.url, {
          method: config.method || 'GET',
          headers: { 'Content-Type': 'application/json', ...config.headers },
          body: config.body ? JSON.stringify(config.body) : undefined,
        });

        // Throw on error status
        if (!response.ok) {
          throw new HttpError({
            message: `HTTP ${response.status}: ${response.statusText}`,
            code:
              response.status === 404
                ? ErrorCode.HTTP_REQUEST_FAILED
                : ErrorCode.HTTP_REQUEST_FAILED,
            upstreamStatus: response.status,
            url: config.url,
          });
        }

        return response.json();
      },
      `HTTP ${config.method || 'GET'} to ${config.url}`,
      {
        maxRetries: config.retries || 3,
        timeout: 30000,
      }
    );

    return result;
  } catch (error) {
    // Already wrapped in HttpError or CustomError
    throw error;
  }
}

// ============================================================================
// EXAMPLE 5: Error Persistence
// ============================================================================

import { PrismaClient } from '@prisma/client';

import { getCriticalErrors, persistExecutionError } from '@/utils/error-persistence';

async function handleExecutionError(
  prisma: PrismaClient,
  error: CustomError,
  executionId: string,
  nodeLogId?: string
) {
  // Save error to database
  await persistExecutionError(prisma, error, executionId, nodeLogId);

  // Get all critical errors for this execution
  const criticalErrors = await getCriticalErrors(prisma, executionId);

  if (criticalErrors.length > 0) {
    console.log(`Found ${criticalErrors.length} critical errors`);
    console.log('Notifying user...');
  }
}

// ============================================================================
// EXAMPLE 6: Setting Up Error Notifications
// ============================================================================

import { PrismaClient } from '@prisma/client';

async function setupErrorNotifications(prisma: PrismaClient, tenantId: string) {
  // Create webhook notification for critical errors
  await prisma.errorNotificationConfig.create({
    data: {
      tenantId,
      name: 'Critical Errors - Slack',
      type: 'WEBHOOK',
      webhookUrl: 'https://hooks.slack.com/services/YOUR/WEBHOOK/URL',
      minSeverity: 'CRITICAL',
      isActive: true,
      errorCodes: ['ERR_3000', 'ERR_4000'], // NODE_EXECUTION_FAILED, HTTP_REQUEST_FAILED
    },
  });

  // Create email notification for high severity errors
  await prisma.errorNotificationConfig.create({
    data: {
      tenantId,
      name: 'High Severity Errors - Email',
      type: 'EMAIL',
      email: 'admin@example.com',
      minSeverity: 'HIGH',
      isActive: true,
    },
  });
}

// ============================================================================
// EXAMPLE 7: Complete Execution Flow with Error Handling
// ============================================================================

import { ExecutionService } from '@/services/execution.service';
import { Logger } from '@/services/logger.service';

async function runWorkflowWithErrorHandling(
  executionService: ExecutionService,
  workflowId: string,
  userId: string,
  tenantId: string
) {
  const logger = Logger.getInstance();

  try {
    // Start execution
    logger.info('Starting workflow execution', {
      context: { workflowId, userId, tenantId },
    });

    const execution = await executionService.execute({
      workflowId,
      userId,
      trigger: 'MANUAL',
      input: {
        /* user input */
      },
      tenantId,
    });

    logger.info('Workflow execution initiated', {
      context: {
        workflowId,
        executionId: execution.id,
        userId,
        tenantId,
      },
    });

    // Execution happens asynchronously
    // Errors are logged, persisted, and notified automatically
  } catch (error) {
    const customError =
      error instanceof CustomError
        ? error
        : new CustomError({
            message: error instanceof Error ? error.message : 'Unknown error',
            code: ErrorCode.UNKNOWN_ERROR,
            context: { workflowId, userId, tenantId },
          });

    logger.logError(customError, 'Failed to start workflow execution');
    throw customError;
  }
}

// ============================================================================
// EXAMPLE 8: Using Logger with Context
// ============================================================================

import { Logger } from '@/services/logger.service';

async function processWithLogging(executionId: string, nodeId: string) {
  const logger = Logger.getInstance();

  // Create a context-aware logger
  const contextLogger = logger.child({
    executionId,
    nodeId,
    workflowId: 'wf-123',
  });

  try {
    contextLogger.debug('Starting node processing');

    const startTime = Date.now();
    const result = await processNode();
    const duration = Date.now() - startTime;

    contextLogger.info('Node processing completed', {
      metadata: { duration, resultSize: JSON.stringify(result).length },
    });

    return result;
  } catch (error) {
    const duration = Date.now() - startTime;
    contextLogger.error('Node processing failed', {
      error,
      metadata: { duration },
    });
    throw error;
  }
}

// ============================================================================
// EXAMPLE 9: External Service with Retry
// ============================================================================

import { ErrorCode, ExternalServiceError } from '@/errors/custom-error';
import { withExternalServiceRetry } from '@/utils/retry';

async function sendEmailWithRetry(emailConfig: any) {
  try {
    const result = await withExternalServiceRetry(
      async () => {
        // Assuming you have an email service
        return await emailService.send({
          to: emailConfig.to,
          subject: emailConfig.subject,
          body: emailConfig.body,
        });
      },
      'Email Service',
      {
        maxRetries: 2,
        initialDelay: 2000,
      }
    );
    return result;
  } catch (error) {
    if (error instanceof ExternalServiceError) {
      console.error(`Email service error: ${error.message}`);
      console.error(`User message: ${error.userMessage}`);
    }
    throw error;
  }
}

// ============================================================================
// EXAMPLE 10: Error Recovery Strategy
// ============================================================================

import { CustomError, ErrorSeverity } from '@/errors/custom-error';

async function executeWithRecovery(operation: () => Promise<any>) {
  const maxAttempts = 3;
  let lastError: CustomError | null = null;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError =
        error instanceof CustomError
          ? error
          : new CustomError({
              message: error instanceof Error ? error.message : String(error),
              code: ErrorCode.UNKNOWN_ERROR,
            });

      // Don't retry non-retryable errors
      if (!lastError.isRetryable) {
        throw lastError;
      }

      // Log attempt
      console.log(`Attempt ${attempt}/${maxAttempts} failed, retrying...`);

      // Wait before retry
      if (attempt < maxAttempts) {
        const delay = Math.pow(2, attempt) * 1000; // Exponential backoff
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }

  throw lastError || new Error('Operation failed after retries');
}

// ============================================================================
// EXAMPLE 11: Workflow Validation
// ============================================================================

import { ErrorCode, WorkflowError } from '@/errors/custom-error';

function validateWorkflowStructure(nodes: any[], connections: any[]) {
  // Check for orphaned nodes
  const nodeIds = new Set(nodes.map(n => n.id));

  for (const conn of connections) {
    if (!nodeIds.has(conn.source) || !nodeIds.has(conn.target)) {
      throw new WorkflowError({
        message: `Connection references non-existent node: ${conn.source} -> ${conn.target}`,
        code: ErrorCode.WORKFLOW_INVALID,
        workflowId: '',
        userMessage: 'Workflow has invalid connections',
      });
    }
  }

  // Additional validations...
}

// ============================================================================
// Export Examples
// ============================================================================

export {
  executeNode,
  executeWithRecovery,
  fetchUserDataWithRetry,
  handleExecutionError,
  makeHttpRequest,
  processWithLogging,
  runWorkflowWithErrorHandling,
  sendEmailWithRetry,
  setupErrorNotifications,
  validateWorkflow,
  validateWorkflowStructure,
};
