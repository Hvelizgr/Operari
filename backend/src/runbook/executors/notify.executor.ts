import {
    StepExecutor,
    ExecutorContext,
    ExecutorResult,
    resolveTemplate,
} from '../types/executor.types';

export interface NotifyConfig {
    /** Notification channel */
    channel: 'slack' | 'discord' | 'webhook';
    /** Webhook URL of the destination */
    webhookUrl: string;
    /** Message body (supports template substitution) */
    message: string;
    /** Optional title (Slack/Discord) */
    title?: string;
    /** Color for embed (Discord/Slack): "good" | "warning" | "danger" | hex */
    color?: string;
}

/**
 * Notification executor.
 *
 * Sends messages to Slack, Discord, or any generic webhook.
 * Used to notify the team about runbook progress, completion, or issues.
 */
export class NotifyExecutor implements StepExecutor<NotifyConfig> {
    readonly type = 'notify';

    async execute(config: NotifyConfig, context: ExecutorContext): Promise<ExecutorResult> {
        const startTime = Date.now();
        const message = resolveTemplate(config.message, context);
        const title = config.title ? resolveTemplate(config.title, context) : undefined;

        try {
            const payload = this.buildPayload(config.channel, { message, title, color: config.color });

            const response = await fetch(config.webhookUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
            });

            if (!response.ok) {
                return {
                    success: false,
                    error: `Notification failed: ${response.status} ${response.statusText}`,
                    duration: Date.now() - startTime,
                };
            }

            context.emit?.({
                type: 'log',
                text: `Notification sent to ${config.channel}`,
                timestamp: new Date(),
            });

            return {
                success: true,
                output: { channel: config.channel, message, sent: true },
                duration: Date.now() - startTime,
            };
        } catch (err) {
            return {
                success: false,
                error: err instanceof Error ? err.message : String(err),
                duration: Date.now() - startTime,
            };
        }
    }

    private buildPayload(
        channel: 'slack' | 'discord' | 'webhook',
        opts: { message: string; title?: string; color?: string },
    ): Record<string, unknown> {
        switch (channel) {
            case 'slack':
                if (opts.title) {
                    return {
                        attachments: [{
                            color: opts.color ?? 'good',
                            title: opts.title,
                            text: opts.message,
                        }],
                    };
                }
                return { text: opts.message };

            case 'discord':
                return {
                    content: opts.title ? `**${opts.title}**\n${opts.message}` : opts.message,
                };

            case 'webhook':
            default:
                return { message: opts.message, title: opts.title };
        }
    }
}

export const notifyExecutor = new NotifyExecutor();
