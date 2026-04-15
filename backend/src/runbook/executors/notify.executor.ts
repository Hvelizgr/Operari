import {
    StepExecutor,
    ExecutorContext,
    ExecutorResult,
    resolveTemplate,
} from '../types/executor.types';

export interface NotifyConfig {
    /**
     * Notification channel. Each channel has a different payload shape
     * and a different way to interpret success / failure responses.
     */
    channel: 'slack' | 'discord' | 'webhook';
    /**
     * Webhook URL of the destination. Supports template substitution
     * via `{{vars.foo}}` (set per trigger) and `{{secrets.<id>}}`
     * (resolved from a connected account at run time — pre-resolved
     * by SecretTemplateResolver before this executor is invoked, so
     * the audit chain records exactly one `secret.accessed` event per
     * unique account per step).
     */
    webhookUrl: string;
    /** Message body (supports template substitution). */
    message: string;
    /** Optional title (Slack/Discord). */
    title?: string;
    /** Color for embed (Slack/Discord): "good" | "warning" | "danger" | hex. */
    color?: string;
}

/**
 * Maximum payload size for a Slack incoming webhook before Slack
 * starts rejecting with HTTP 413. Slack's documented limit is 40KB
 * but in practice attachments above ~36KB get truncated mid-message
 * with no warning, so we cap at 35KB and append an explicit marker.
 */
const MAX_MESSAGE_BYTES = 35 * 1024;

/**
 * How many times to retry on a 429 / network failure. Slack's
 * incoming webhook rate limit is 1 message per second per webhook,
 * with bursts allowed. Three retries with `Retry-After` honoured
 * covers the common rate-limit shapes without making a runbook
 * step hang for minutes.
 */
const MAX_RETRIES = 3;
const DEFAULT_RETRY_DELAY_MS = 1000;

/**
 * Notify step.
 *
 * Sends a message to Slack, Discord, or any HTTP webhook. Used to
 * announce runbook progress, completion, or escalation. The most
 * common pattern is a single notify step at the end of the runbook
 * with the human-readable summary; the second most common is a
 * notify branch on the error path of a critical step.
 *
 * Slack-specific behaviour:
 *   - response.ok is checked first
 *   - Slack returns 200 with body `ok` on success and 200 with body
 *     `invalid_token` / `no_service` / `no_team` on configuration
 *     errors. We treat any non-`ok` body as failure.
 *   - 429 responses honour the `Retry-After` header up to MAX_RETRIES
 *
 * Discord uses standard 4xx/5xx semantics; the executor falls through
 * to the response.ok path for everything except 429.
 */
export class NotifyExecutor implements StepExecutor<NotifyConfig> {
    readonly type = 'notify';

    /** Override-able for tests. Real path uses `globalThis.fetch`. */
    private readonly httpFetch: typeof fetch;

    constructor(httpFetch: typeof fetch = fetch) {
        this.httpFetch = httpFetch;
    }

    async execute(config: NotifyConfig, context: ExecutorContext): Promise<ExecutorResult> {
        const startTime = Date.now();

        // 1. Resolve templates in user-controlled fields. webhookUrl
        //    too — see the doc on the field for the secrets caveat.
        const webhookUrl = resolveTemplate(config.webhookUrl ?? '', context);
        const rawMessage = resolveTemplate(config.message ?? '', context);
        const title = config.title ? resolveTemplate(config.title, context) : undefined;

        // 2. Validate the URL shape before we send anything. The
        //    executor refuses non-https URLs because a webhook in
        //    plaintext leaks the bearer token to anyone on the path.
        const urlError = validateWebhookUrl(webhookUrl, config.channel);
        if (urlError) {
            return { success: false, error: urlError, duration: Date.now() - startTime };
        }

        // 3. Truncate long messages so Slack does not silently swallow
        //    them. Append an explicit marker so the operator knows the
        //    output was clipped.
        const message = truncate(rawMessage, MAX_MESSAGE_BYTES);

        const payload = this.buildPayload(config.channel, {
            message,
            title,
            color: config.color,
        });

        try {
            const sendResult = await this.sendWithRetry(webhookUrl, payload, config.channel);
            if (!sendResult.ok) {
                return {
                    success: false,
                    error: sendResult.error,
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
                output: {
                    channel: config.channel,
                    sent: true,
                    truncated: rawMessage.length !== message.length,
                    bytesSent: Buffer.byteLength(message, 'utf-8'),
                },
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

    private async sendWithRetry(
        url: string,
        payload: Record<string, unknown>,
        channel: NotifyConfig['channel'],
    ): Promise<{ ok: true } | { ok: false; error: string }> {
        for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
            const response = await this.httpFetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
            });

            // Slack: a 200 OK with body "ok" is success. Anything else
            // — including 200 with body "invalid_token" — is failure.
            if (channel === 'slack' && response.ok) {
                const body = (await response.text()).trim();
                if (body === 'ok') return { ok: true };
                return {
                    ok: false,
                    error: `Slack rejected the message: ${body || '(empty body)'}`,
                };
            }

            if (response.ok) return { ok: true };

            // 429 → honour Retry-After up to MAX_RETRIES.
            if (response.status === 429 && attempt < MAX_RETRIES) {
                const retryAfter = response.headers.get('Retry-After');
                const delayMs = parseRetryAfter(retryAfter) ?? DEFAULT_RETRY_DELAY_MS * attempt;
                await sleep(delayMs);
                continue;
            }

            // Anything else is a hard failure.
            const body = await response.text().catch(() => '');
            return {
                ok: false,
                error: `Notification failed: HTTP ${response.status} ${response.statusText}${body ? ` — ${body.slice(0, 200)}` : ''}`,
            };
        }
        return { ok: false, error: `Notification failed after ${MAX_RETRIES} attempts` };
    }

    private buildPayload(
        channel: NotifyConfig['channel'],
        opts: { message: string; title?: string; color?: string },
    ): Record<string, unknown> {
        switch (channel) {
            case 'slack':
                if (opts.title) {
                    return {
                        attachments: [
                            {
                                color: opts.color ?? 'good',
                                title: opts.title,
                                text: opts.message,
                            },
                        ],
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

function validateWebhookUrl(url: string, channel: NotifyConfig['channel']): string | null {
    if (!url) return 'webhookUrl is required';
    let parsed: URL;
    try {
        parsed = new URL(url);
    } catch {
        return `webhookUrl is not a valid URL: ${url.slice(0, 80)}`;
    }
    if (parsed.protocol !== 'https:') {
        return `webhookUrl must be https (got ${parsed.protocol}). Sending webhook tokens over plaintext leaks them.`;
    }
    if (channel === 'slack' && !parsed.hostname.endsWith('slack.com')) {
        return `Slack webhook URL must point at slack.com (got ${parsed.hostname}). Set channel: webhook for generic endpoints.`;
    }
    if (channel === 'discord' && !parsed.hostname.endsWith('discord.com') && !parsed.hostname.endsWith('discordapp.com')) {
        return `Discord webhook URL must point at discord.com or discordapp.com (got ${parsed.hostname}).`;
    }
    return null;
}

function truncate(text: string, maxBytes: number): string {
    const buf = Buffer.from(text, 'utf-8');
    if (buf.byteLength <= maxBytes) return text;
    const marker = '\n\n[truncated by NanoRun notify step]';
    const allowed = maxBytes - Buffer.byteLength(marker, 'utf-8');
    return buf.subarray(0, allowed).toString('utf-8') + marker;
}

function parseRetryAfter(header: string | null): number | null {
    if (!header) return null;
    const seconds = Number(header);
    if (Number.isFinite(seconds) && seconds >= 0) return Math.min(seconds * 1000, 10000);
    return null;
}

function sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

export const notifyExecutor = new NotifyExecutor();
