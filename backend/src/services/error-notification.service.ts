import { PrismaClient } from '@prisma/client';
import { CustomError, ErrorSeverity } from '../errors/custom-error';
import { Logger } from './logger.service';
import { markErrorAsNotified } from '../utils/error-persistence';
import { EmailService } from './email.service';
import { SlackService } from './integrations/slack.service';

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
            const prismaErrorSeverity = error.severity.toUpperCase() as any;

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

                case 'SLACK':
                    await this.sendSlackNotification(config.slackWebhookUrl as string, payload);
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
                    configId: (config as any).id,
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
                    'User-Agent': 'NanoFlow/1.0',
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
const emailService = EmailService.getInstance();

if (!emailService.isConfigured()) {
this.logger.warn('Email notification requested but SMTP not configured');
return;
}
        await emailService.send({
            to: email,
            subject: `NanoFlow Alert: [${payload.severity.toUpperCase()}] Error in ${payload.workflowName || 'Workflow'}`,
            html: this.formatEmailBody(payload),
        });

        this.logger.debug('Email error notification sent', { metadata: { email } });
    }

    /**
     * Send Slack notification
     */
    private async sendSlackNotification(
        webhookUrl: string,
        payload: ErrorNotificationPayload
    ): Promise<void> {
        const slackService = SlackService.getInstance();
        const message = this.formatSlackMessage(payload);
        await slackService.sendMessage(webhookUrl, message);
        this.logger.debug('Slack error notification sent');
    }

    private formatEmailBody(payload: ErrorNotificationPayload): string {
return `
<div style="font-family: sans-serif; max-width: 600px; margin: auto; padding: 20px; border: 1px solid #eee; border-radius: 8px;">
<h2 style="color: #ef4444;">🚨 NanoFlow Execution Error</h2>
<p>An error occurred during the execution of a critical workflow.</p>

<table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
<tr><td style="padding: 8px; font-weight: bold; border-bottom: 1px solid #f4f4f5;">Workflow:</td><td style="padding: 8px; border-bottom: 1px solid #f4f4f5;">${payload.workflowName || 'Unknown'}</td></tr>
<tr><td style="padding: 8px; font-weight: bold; border-bottom: 1px solid #f4f4f5;">Severity:</td><td style="padding: 8px; border-bottom: 1px solid #f4f4f5; color: #ef4444;">${payload.severity.toUpperCase()}</td></tr>
<tr><td style="padding: 8px; font-weight: bold; border-bottom: 1px solid #f4f4f5;">Node:</td><td style="padding: 8px; border-bottom: 1px solid #f4f4f5;">${payload.nodeName || payload.nodeType || 'System'}</td></tr>
<tr><td style="padding: 8px; font-weight: bold; border-bottom: 1px solid #f4f4f5;">Error:</td><td style="padding: 8px; border-bottom: 1px solid #f4f4f5; font-family: monospace;">${payload.errorMessage}</td></tr>
<tr><td style="padding: 8px; font-weight: bold; border-bottom: 1px solid #f4f4f5;">Timestamp:</td><td style="padding: 8px; border-bottom: 1px solid #f4f4f5;">${payload.timestamp}</td></tr>
</table>

<div style="text-align: center; margin-top: 30px;">
<a href="${process.env.FRONTEND_URL || 'http://localhost:3000'}/workflows/${payload.workflowId}/executions/${payload.executionId}" 
style="background: #6366f1; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold;">
View Execution Details
</a>
</div>
</div>
`;
    }

    private formatSlackMessage(payload: ErrorNotificationPayload): string {
        const severityEmoji = payload.severity === 'critical' ? '🔴' : (payload.severity === 'high' ? '🟠' : '🟡');
        return `${severityEmoji} *NanoFlow Error Alert*
*Workflow:* ${payload.workflowName || 'Unknown'} (${payload.workflowId})
*Node:* ${payload.nodeName || payload.nodeType || 'System'}
*Error:* \`${payload.errorMessage}\`
*Severity:* ${payload.severity.toUpperCase()}
*Timestamp:* ${payload.timestamp}

<${process.env.FRONTEND_URL || 'http://localhost:3000'}/workflows/${payload.workflowId}/executions/${payload.executionId}|View Execution Details>`;
    }

    /**
     * Format severity filter for query - returns the minimum severity as uppercase
     */

    /**
     * Emit internal event for error (for pub/sub systems, event buses, etc.)
     */
    async emitErrorEvent(
        error: CustomError,
        executionId: string
    ): Promise<void> {
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
