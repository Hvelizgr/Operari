
import { prisma } from '../server';
import { logger } from '../config/logger.config';

export enum NotificationChannel {
    EMAIL = 'EMAIL',
    SLACK = 'SLACK',
    WEBHOOK = 'WEBHOOK',
    IN_APP = 'IN_APP'
}

export enum NotificationPriority {
    LOW = 'LOW',
    MEDIUM = 'MEDIUM',
    HIGH = 'HIGH',
    CRITICAL = 'CRITICAL'
}

export interface NotificationPayload {
    tenantId: string;
    userId?: string;
    title: string;
    message: string;
    priority: NotificationPriority;
    channels: NotificationChannel[];
    metadata?: Record<string, any>;
    actionUrl?: string;
}

export class NotificationService {
    private static instance: NotificationService;

    private constructor() {}

    public static getInstance(): NotificationService {
        if (!NotificationService.instance) {
            NotificationService.instance = new NotificationService();
        }
        return NotificationService.instance;
    }

    /**
     * Send a notification through multiple channels
     */
    public async send(payload: NotificationPayload): Promise<void> {
        const { tenantId, userId, title, message, priority, channels, metadata, actionUrl } = payload;

        console.log('[NotificationService] Sending notification:', { tenantId, userId, title, priority, channels });

        // Send through each requested channel
        const promises = channels.map(channel => {
            switch (channel) {
                case NotificationChannel.EMAIL:
                    return this.sendEmail(payload);
                case NotificationChannel.SLACK:
                    return this.sendSlack(payload);
                case NotificationChannel.WEBHOOK:
                    return this.sendWebhook(payload);
                case NotificationChannel.IN_APP:
                    return this.sendInApp(payload);
                default:
                    return Promise.resolve();
            }
        });

        await Promise.allSettled(promises);
    }

    /**
     * Send email notification
     */
    private async sendEmail(payload: NotificationPayload): Promise<void> {
        try {
            const { tenantId, userId, title, message } = payload;

            // Get user email
            if (!userId) return;

            const user = await prisma.user.findUnique({
                where: { id: userId },
                select: { email: true, name: true }
            });

            if (!user?.email) return;

            const nodemailer = require('nodemailer');
            
            if (!process.env.SMTP_HOST) {
                logger.warn('SMTP not configured, skipping email notification');
                return;
            }

            const transporter = nodemailer.createTransport({
                host: process.env.SMTP_HOST,
                port: parseInt(process.env.SMTP_PORT || '587'),
                secure: false,
                auth: {
                    user: process.env.SMTP_USER,
                    pass: process.env.SMTP_PASS,
                },
            });

            await transporter.sendMail({
                from: process.env.SMTP_USER,
                to: user.email,
                subject: `[NanoFlow] ${title}`,
                text: message,
                html: `
                    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                        <h2 style="color: #dc2626;">${title}</h2>
                        <p>${message}</p>
                        ${payload.actionUrl ? `<a href="${payload.actionUrl}" style="display: inline-block; padding: 10px 20px; background: #dc2626; color: white; text-decoration: none; border-radius: 5px; margin-top: 20px;">View Details</a>` : ''}
                    </div>
                `
            });

            console.log('[NotificationService] Email notification sent to:', user.email);
        } catch (error) {
            console.error('[NotificationService] Failed to send email:', error);
        }
    }

    /**
     * Send Slack notification
     */
    private async sendSlack(payload: NotificationPayload): Promise<void> {
        try {
            const { title, message, priority, actionUrl } = payload;

            // Get Slack webhook from tenant settings or env
            const webhookUrl = process.env.SLACK_WEBHOOK_URL;
            if (!webhookUrl) {
                console.warn('[NotificationService] Slack webhook not configured');
                return;
            }

            const axios = require('axios');
            const color = this.getPriorityColor(priority);

            await axios.post(webhookUrl, {
                attachments: [{
                    color,
                    title,
                    text: message,
                    footer: 'NanoFlow',
                    ts: Math.floor(Date.now() / 1000),
                    actions: actionUrl ? [{
                        type: 'button',
                        text: 'View Details',
                        url: actionUrl
                    }] : undefined
                }]
            });

            console.log('[NotificationService] Slack notification sent');
        } catch (error) {
            console.error('[NotificationService] Failed to send Slack notification:', error);
        }
    }

    /**
     * Send webhook notification
     */
    private async sendWebhook(payload: NotificationPayload): Promise<void> {
        try {
            const { tenantId } = payload;

            // Get webhook URLs from tenant notification config
            const configs = await prisma.errorNotificationConfig.findMany({
                where: {
                    tenantId,
                    type: 'WEBHOOK',
                    isActive: true
                }
            });

            if (configs.length === 0) return;

            const axios = require('axios');
            const promises = configs.map(config => {
                if (!config.webhookUrl) return Promise.resolve();
                return axios.post(config.webhookUrl, payload);
            });

            await Promise.allSettled(promises);
            console.log('[NotificationService] Webhook notifications sent, count:', configs.length);
        } catch (error) {
            console.error('[NotificationService] Failed to send webhook notification:', error);
        }
    }

    /**
     * Send in-app notification (store in database)
     */
    private async sendInApp(payload: NotificationPayload): Promise<void> {
        try {
            const { tenantId, userId, title, message, priority, metadata } = payload;

            await prisma.alertHistory.create({
                data: {
                    tenantId,
                    type: 'CUSTOM',
                    severity: this.mapPriorityToSeverity(priority) as any,
                    title,
                    message,
                    metadata: metadata || {},
                    isRead: false
                }
            });

            console.log('[NotificationService] In-app notification created');
        } catch (error) {
            console.error('[NotificationService] Failed to create in-app notification:', error);
        }
    }

    /**
     * Helper: Map priority to Slack color
     */
    private getPriorityColor(priority: NotificationPriority): string {
        switch (priority) {
            case NotificationPriority.CRITICAL:
                return '#dc2626'; // red
            case NotificationPriority.HIGH:
                return '#f59e0b'; // orange
            case NotificationPriority.MEDIUM:
                return '#3b82f6'; // blue
            case NotificationPriority.LOW:
            default:
                return '#6b7280'; // gray
        }
    }

    /**
     * Helper: Map priority to error severity
     */
    private mapPriorityToSeverity(priority: NotificationPriority): string {
        switch (priority) {
            case NotificationPriority.CRITICAL:
                return 'CRITICAL';
            case NotificationPriority.HIGH:
                return 'HIGH';
            case NotificationPriority.MEDIUM:
                return 'MEDIUM';
            case NotificationPriority.LOW:
            default:
                return 'LOW';
        }
    }

    /**
     * Quick helper: Send workflow failure notification
     */
    public async notifyWorkflowFailure(params: {
        tenantId: string;
        userId: string;
        workflowName: string;
        error: string;
        executionId: string;
    }): Promise<void> {
        await this.send({
            tenantId: params.tenantId,
            userId: params.userId,
            title: `Workflow Failed: ${params.workflowName}`,
            message: `Your workflow "${params.workflowName}" has failed with error: ${params.error}`,
            priority: NotificationPriority.HIGH,
            channels: [NotificationChannel.EMAIL, NotificationChannel.IN_APP],
            metadata: { executionId: params.executionId },
            actionUrl: `${process.env.FRONTEND_URL}/executions/${params.executionId}`
        });
    }

    /**
     * Quick helper: Send credential expiring notification
     */
    public async notifyCredentialExpiring(params: {
        tenantId: string;
        userId: string;
        credentialName: string;
        daysUntilExpiry: number;
    }): Promise<void> {
        await this.send({
            tenantId: params.tenantId,
            userId: params.userId,
            title: 'Credential Expiring Soon',
            message: `Your credential "${params.credentialName}" will expire in ${params.daysUntilExpiry} days.`,
            priority: NotificationPriority.MEDIUM,
            channels: [NotificationChannel.EMAIL, NotificationChannel.IN_APP]
        });
    }
}

export const notificationService = NotificationService.getInstance();
