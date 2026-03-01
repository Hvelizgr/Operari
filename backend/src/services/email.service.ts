import nodemailer from 'nodemailer';
import { logger } from '../config/logger.config';

export interface EmailOptions {
    to: string;
    subject: string;
    text?: string;
    html?: string;
}

export class EmailService {
    private static instance: EmailService;
    private transporter: nodemailer.Transporter | null = null;

    private constructor() {
        this.initTransporter();
    }

    public static getInstance(): EmailService {
        if (!EmailService.instance) {
            EmailService.instance = new EmailService();
        }
        return EmailService.instance;
    }

    private initTransporter(): void {
        if (!process.env.SMTP_HOST) {
            logger.warn('SMTP not configured. Email sending disabled.');
            return;
        }

        this.transporter = nodemailer.createTransport({
            host: process.env.SMTP_HOST,
            port: parseInt(process.env.SMTP_PORT || '587'),
            secure: process.env.SMTP_SECURE === 'true',
            auth: {
                user: process.env.SMTP_USER,
                pass: process.env.SMTP_PASS,
            },
        });
    }

    public async send(options: EmailOptions): Promise<boolean> {
        if (!this.transporter) {
            logger.warn('Email not sent - SMTP not configured');
            return false;
        }

        try {
            await this.transporter.sendMail({
                from: process.env.SMTP_FROM || process.env.SMTP_USER,
                to: options.to,
                subject: options.subject,
                text: options.text,
                html: options.html,
            });
            logger.info({ to: options.to, subject: options.subject }, 'Email sent successfully');
            return true;
        } catch (error) {
            logger.error({ error, to: options.to }, 'Failed to send email');
            return false;
        }
    }

    public async sendVerificationEmail(email: string, token: string, name?: string): Promise<boolean> {
        const verifyUrl = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/verify-email?token=${token}`;
        const userName = name || email.split('@')[0];

        return this.send({
            to: email,
            subject: 'Verify your NanoFlow account',
            html: `
                <!DOCTYPE html>
                <html>
                <head>
                    <meta charset="utf-8">
                    <meta name="viewport" content="width=device-width, initial-scale=1.0">
                </head>
                <body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f4f4f5;">
                    <table cellpadding="0" cellspacing="0" border="0" width="100%" style="min-width: 100%; background-color: #f4f4f5;">
                        <tr>
                            <td align="center" style="padding: 40px 20px;">
                                <table cellpadding="0" cellspacing="0" border="0" width="600" style="max-width: 600px; background-color: #ffffff; border-radius: 8px; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
                                    <tr>
                                        <td style="padding: 40px 40px 20px; text-align: center; background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%); border-radius: 8px 8px 0 0;">
                                            <h1 style="margin: 0; color: #ffffff; font-size: 28px; font-weight: 700;">NanoFlow</h1>
                                        </td>
                                    </tr>
                                    <tr>
                                        <td style="padding: 40px;">
                                            <h2 style="margin: 0 0 20px; color: #18181b; font-size: 24px; font-weight: 600;">Welcome, ${userName}!</h2>
                                            <p style="margin: 0 0 20px; color: #52525b; font-size: 16px; line-height: 24px;">
                                                Thanks for signing up for NanoFlow. Please verify your email address to get started.
                                            </p>
                                            <table cellpadding="0" cellspacing="0" border="0" width="100%">
                                                <tr>
                                                    <td align="center" style="padding: 20px 0;">
                                                        <a href="${verifyUrl}" style="display: inline-block; padding: 14px 32px; background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%); color: #ffffff; text-decoration: none; border-radius: 8px; font-size: 16px; font-weight: 600;">
                                                            Verify Email Address
                                                        </a>
                                                    </td>
                                                </tr>
                                            </table>
                                            <p style="margin: 20px 0 0; color: #71717a; font-size: 14px; line-height: 20px;">
                                                This link will expire in 24 hours. If you didn't create an account, you can safely ignore this email.
                                            </p>
                                            <hr style="margin: 30px 0; border: none; border-top: 1px solid #e4e4e7;">
                                            <p style="margin: 0; color: #a1a1aa; font-size: 12px;">
                                                If the button doesn't work, copy and paste this URL into your browser:<br>
                                                <a href="${verifyUrl}" style="color: #6366f1; word-break: break-all;">${verifyUrl}</a>
                                            </p>
                                        </td>
                                    </tr>
                                </table>
                            </td>
                        </tr>
                    </table>
                </body>
                </html>
            `,
            text: `Welcome to NanoFlow!\n\nPlease verify your email by clicking this link: ${verifyUrl}\n\nThis link expires in 24 hours.`,
        });
    }

    public async sendPasswordResetEmail(email: string, token: string, name?: string): Promise<boolean> {
        const resetUrl = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/reset-password?token=${token}`;
        const userName = name || email.split('@')[0];

        return this.send({
            to: email,
            subject: 'Reset your NanoFlow password',
            html: `
                <!DOCTYPE html>
                <html>
                <head>
                    <meta charset="utf-8">
                    <meta name="viewport" content="width=device-width, initial-scale=1.0">
                </head>
                <body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f4f4f5;">
                    <table cellpadding="0" cellspacing="0" border="0" width="100%" style="min-width: 100%; background-color: #f4f4f5;">
                        <tr>
                            <td align="center" style="padding: 40px 20px;">
                                <table cellpadding="0" cellspacing="0" border="0" width="600" style="max-width: 600px; background-color: #ffffff; border-radius: 8px; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
                                    <tr>
                                        <td style="padding: 40px 40px 20px; text-align: center; background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%); border-radius: 8px 8px 0 0;">
                                            <h1 style="margin: 0; color: #ffffff; font-size: 28px; font-weight: 700;">NanoFlow</h1>
                                        </td>
                                    </tr>
                                    <tr>
                                        <td style="padding: 40px;">
                                            <h2 style="margin: 0 0 20px; color: #18181b; font-size: 24px; font-weight: 600;">Reset Your Password</h2>
                                            <p style="margin: 0 0 20px; color: #52525b; font-size: 16px; line-height: 24px;">
                                                Hi ${userName}, we received a request to reset your password. Click the button below to create a new one.
                                            </p>
                                            <table cellpadding="0" cellspacing="0" border="0" width="100%">
                                                <tr>
                                                    <td align="center" style="padding: 20px 0;">
                                                        <a href="${resetUrl}" style="display: inline-block; padding: 14px 32px; background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%); color: #ffffff; text-decoration: none; border-radius: 8px; font-size: 16px; font-weight: 600;">
                                                            Reset Password
                                                        </a>
                                                    </td>
                                                </tr>
                                            </table>
                                            <p style="margin: 20px 0 0; color: #71717a; font-size: 14px; line-height: 20px;">
                                                This link will expire in 1 hour. If you didn't request a password reset, you can safely ignore this email.
                                            </p>
                                            <hr style="margin: 30px 0; border: none; border-top: 1px solid #e4e4e7;">
                                            <p style="margin: 0; color: #a1a1aa; font-size: 12px;">
                                                If the button doesn't work, copy and paste this URL into your browser:<br>
                                                <a href="${resetUrl}" style="color: #6366f1; word-break: break-all;">${resetUrl}</a>
                                            </p>
                                        </td>
                                    </tr>
                                </table>
                            </td>
                        </tr>
                    </table>
                </body>
                </html>
            `,
            text: `Reset Your NanoFlow Password\n\nClick this link to reset your password: ${resetUrl}\n\nThis link expires in 1 hour.`,
        });
    }

    public async sendQuotaWarningEmail(
        email: string, 
        resourceType: 'executions' | 'workflows' | 'users',
        current: number,
        limit: number,
        percentage: number,
        tenantName: string
    ): Promise<boolean> {
        const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
        const upgradeUrl = `${frontendUrl}/settings/billing`;
        
        const resourceLabels = {
            executions: 'Monthly Executions',
            workflows: 'Workflows',
            users: 'Team Members'
        };
        
        const isWarning = percentage >= 80 && percentage < 100;
        const statusColor = isWarning ? '#f59e0b' : '#ef4444';
        const statusText = isWarning ? 'approaching your limit' : 'reached your limit';
        const statusTitle = isWarning ? 'Usage Warning' : 'Limit Reached';

        return this.send({
            to: email,
            subject: `NanoFlow: ${resourceLabels[resourceType]} ${isWarning ? '80%' : '100%'} Usage Alert`,
            html: `
                <!DOCTYPE html>
                <html>
                <head>
                    <meta charset="utf-8">
                    <meta name="viewport" content="width=device-width, initial-scale=1.0">
                </head>
                <body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f4f4f5;">
                    <table cellpadding="0" cellspacing="0" border="0" width="100%" style="min-width: 100%; background-color: #f4f4f5;">
                        <tr>
                            <td align="center" style="padding: 40px 20px;">
                                <table cellpadding="0" cellspacing="0" border="0" width="600" style="max-width: 600px; background-color: #ffffff; border-radius: 8px; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
                                    <tr>
                                        <td style="padding: 40px 40px 20px; text-align: center; background: ${statusColor}; border-radius: 8px 8px 0 0;">
                                            <h1 style="margin: 0; color: #ffffff; font-size: 28px; font-weight: 700;">⚠️ ${statusTitle}</h1>
                                        </td>
                                    </tr>
                                    <tr>
                                        <td style="padding: 40px;">
                                            <h2 style="margin: 0 0 20px; color: #18181b; font-size: 24px; font-weight: 600;">
                                                You're ${statusText}
                                            </h2>
                                            <p style="margin: 0 0 20px; color: #52525b; font-size: 16px; line-height: 24px;">
                                                Hi there! Your workspace <strong>${tenantName}</strong> has used <strong>${percentage.toFixed(1)}%</strong> of its ${resourceLabels[resourceType].toLowerCase()} quota.
                                            </p>
                                            
                                            <table cellpadding="0" cellspacing="0" border="0" width="100%" style="background: #f4f4f5; border-radius: 8px; margin: 20px 0;">
                                                <tr>
                                                    <td style="padding: 20px;">
                                                        <table cellpadding="0" cellspacing="0" border="0" width="100%">
                                                            <tr>
                                                                <td style="color: #71717a; font-size: 14px;">Resource</td>
                                                                <td style="color: #18181b; font-size: 14px; font-weight: 600; text-align: right;">${resourceLabels[resourceType]}</td>
                                                            </tr>
                                                            <tr><td colspan="2" style="height: 10px;"></td></tr>
                                                            <tr>
                                                                <td style="color: #71717a; font-size: 14px;">Current Usage</td>
                                                                <td style="color: #18181b; font-size: 14px; font-weight: 600; text-align: right;">${current.toLocaleString()} / ${limit.toLocaleString()}</td>
                                                            </tr>
                                                            <tr><td colspan="2" style="height: 10px;"></td></tr>
                                                            <tr>
                                                                <td style="color: #71717a; font-size: 14px;">Percentage Used</td>
                                                                <td style="color: ${statusColor}; font-size: 14px; font-weight: 600; text-align: right;">${percentage.toFixed(1)}%</td>
                                                            </tr>
                                                        </table>
                                                    </td>
                                                </tr>
                                            </table>

                                            <p style="margin: 0 0 20px; color: #52525b; font-size: 16px; line-height: 24px;">
                                                ${isWarning 
                                                    ? 'To ensure uninterrupted service, consider upgrading your plan before reaching the limit.' 
                                                    : 'You have reached your limit. Please upgrade your plan to continue using this feature.'}
                                            </p>

                                            <table cellpadding="0" cellspacing="0" border="0" width="100%">
                                                <tr>
                                                    <td align="center" style="padding: 20px 0;">
                                                        <a href="${upgradeUrl}" style="display: inline-block; padding: 14px 32px; background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%); color: #ffffff; text-decoration: none; border-radius: 8px; font-size: 16px; font-weight: 600;">
                                                            Upgrade Plan
                                                        </a>
                                                    </td>
                                                </tr>
                                            </table>
                                            
                                            <hr style="margin: 30px 0; border: none; border-top: 1px solid #e4e4e7;">
                                            <p style="margin: 0; color: #a1a1aa; font-size: 12px; text-align: center;">
                                                You're receiving this email because you're an admin of the ${tenantName} workspace.<br>
                                                <a href="${frontendUrl}/settings/profile" style="color: #6366f1;">Manage notification preferences</a>
                                            </p>
                                        </td>
                                    </tr>
                                </table>
                            </td>
                        </tr>
                    </table>
                </body>
                </html>
            `,
            text: `Usage Alert: ${resourceLabels[resourceType]}\n\nYour workspace ${tenantName} has used ${percentage.toFixed(1)}% of its ${resourceLabels[resourceType].toLowerCase()} quota.\n\nCurrent: ${current.toLocaleString()} / ${limit.toLocaleString()}\n\nUpgrade your plan: ${upgradeUrl}`,
        });
    }

    public isConfigured(): boolean {
        return this.transporter !== null;
    }
}

export const emailService = EmailService.getInstance();
