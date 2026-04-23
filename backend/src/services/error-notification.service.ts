import { PrismaClient } from '@prisma/client';

import { CustomError, ErrorSeverity } from '../errors/custom-error';
import { markErrorAsNotified, toPrismaErrorSeverity } from '../utils/error-persistence';
import { Logger } from './logger.service';

/**
 * Error notification payload
 */
export interface ErrorNotificationPayload {
  executionId: string;
  workflowId: string;
  workflowName?: string;
  errorCode: string;
  errorMessage: string;
  userMessage: string;
  severity: ErrorSeverity;
  nodeId?: string;
  nodeName?: string;
  nodeType?: string;
  timestamp: string;
  retryCount?: number;
  maxRetries?: number;
}

/**
 * Error notification service
 * Handles sending notifications for errors via webhooks and internal events
 */
export class ErrorNotificationService {
  private prisma: PrismaClient;
  private logger: Logger;

  constructor(prisma: PrismaClient) {
    this.prisma = prisma;
    this.logger = Logger.getInstance();
  }

  /**
   * Notify about an error through configured channels
   */
  async notifyError(
    error: CustomError,
    executionId: string,
    errorId: string,
    tenantId: string
  ): Promise<void> {
    try {
      // Convert error severity to Prisma enum format (uppercase)
      const prismaErrorSeverity = toPrismaErrorSeverity(error.severity);

      // Get notification configurations for this tenant
      const configs = await this.prisma.errorNotificationConfig.findMany({
        where: {
          tenantId,
          isActive: true,
          minSeverity: prismaErrorSeverity,
        },
      });

      if (configs.length === 0) {
        this.logger.debug('No active notification configs found for tenant', {
          context: { tenantId },
        });
        return;
      }

      // Prepare notification payload
      const payload: ErrorNotificationPayload = {
        executionId,
        workflowId: error.context.workflowId!,
        workflowName: error.context.workflowName,
        errorCode: error.code,
        errorMessage: error.message,
        userMessage: error.userMessage,
        severity: error.severity,
        nodeId: error.context.nodeId,
        nodeName: error.context.nodeName,
        nodeType: error.context.nodeType,
        timestamp: error.timestamp.toISOString(),
        retryCount: error.context.retryCount,
        maxRetries: error.context.maxRetries,
      };

      // Send notifications through all configured channels
      const notificationPromises = configs.map(config =>
        this.sendNotification(config, payload, errorId)
      );

      await Promise.allSettled(notificationPromises);
    } catch (error) {
      this.logger.error('Error during notification', {
        error: error instanceof Error ? error : new Error(String(error)),
      });
    }
  }

  /**
   * Send notification through a specific channel
   */
  private async sendNotification(
    config: Record<string, unknown>,
    payload: ErrorNotificationPayload,
    errorId: string
  ): Promise<void> {
    try {
      switch (config.type) {
        case 'WEBHOOK':
          await this.sendWebhookNotification(config.webhookUrl as string, payload);
          break;

        case 'EMAIL':
          await this.sendEmailNotification(config.email as string, payload);
          break;

        default:
          this.logger.warn(`Unknown notification type: ${config.type}`);
          return;
      }

      // Mark error as notified
      await markErrorAsNotified(this.prisma, errorId);
    } catch (error) {
      this.logger.warn('Failed to send notification', {
        error: error instanceof Error ? error : new Error(String(error)),
        metadata: {
          // config is already `Record<string, unknown>` (see method signature)
          // so `config.id` is typed — no cast needed.
          configId: config.id,
          type: config.type,
        },
      });
      // Don't throw - continue with other channels
    }
  }

  /**
   * Send webhook notification
   */
  private async sendWebhookNotification(
    webhookUrl: string,
    payload: ErrorNotificationPayload
  ): Promise<void> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);

    try {
      const response = await fetch(webhookUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'cairn/1.0',
        },
        body: JSON.stringify({
          type: 'error',
          payload,
          timestamp: new Date().toISOString(),
        }),
        signal: controller.signal,
      });

      if (!response.ok) {
        throw new Error(`Webhook failed with status ${response.status}: ${response.statusText}`);
      }

      this.logger.debug('Webhook notification sent', {
        metadata: { webhookUrl },
      });
    } finally {
      clearTimeout(timeoutId);
    }
  }

  /**
   * Send email notification
   */
  private async sendEmailNotification(
    email: string,
    payload: ErrorNotificationPayload
  ): Promise<void> {
    // This would integrate with your email service
    // For now, we'll log it as a placeholder
    this.logger.info(`Email notification would be sent to ${email}`, {
      metadata: {
        errorCode: payload.errorCode,
        severity: payload.severity,
      },
    });

    // TODO: Integrate with actual email service (SendGrid, AWS SES, etc.)
    // Example:
    // const emailService = EmailService.getInstance();
    // await emailService.send({
    //     to: email,
    //     subject: `[${payload.severity.toUpperCase()}] Error in workflow ${payload.workflowName}`,
    //     html: this.formatEmailBody(payload),
    // });
  }

  /**
   * Format severity filter for query - returns the minimum severity as uppercase
   */

  /**
   * Emit internal event for error (for pub/sub systems, event buses, etc.)
   */
  async emitErrorEvent(error: CustomError, executionId: string): Promise<void> {
    // This can be extended to emit events to:
    // - Event bus (RabbitMQ, Kafka)
    // - Pub/Sub system
    // - Real-time updates to frontend via WebSocket
    // - Monitoring/alerting systems

    this.logger.info('Error event emitted', {
      context: {
        ...error.context,
        executionId,
      },
      metadata: {
        errorCode: error.code,
        severity: error.severity,
      },
    });

    // TODO: Emit to event bus
    // Example:
    // const eventBus = EventBus.getInstance();
    // eventBus.emit('execution.error', {
    //     executionId,
    //     error: error.toJSON(),
    // });
  }
}
