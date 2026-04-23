import { logger } from '../config/logger.config';
import { sendEmail } from './email.service';

/**
 * MonitorAlertService — notify a human when a Monitor flips to FIRING.
 *
 * Two channels, per-monitor config on the Monitor row:
 *   - alertWebhookUrl  → Slack-compatible incoming webhook. POST once
 *                        per FIRING transition; no retries (the row's
 *                        lastFiredAt is the durable record).
 *   - alertEmail       → single recipient. Delivered via the existing
 *                        sendEmail helper (Resend if configured, log-
 *                        only otherwise).
 *
 * The service is deliberately narrow. Multi-recipient email lists,
 * tenant-level default channels, per-severity routing, PagerDuty —
 * all can layer on top without touching this surface. The P1 gap it
 * closes is "operators cannot hear monitors fire".
 *
 * Fire-and-forget contract: callers MUST NOT await on the hot path
 * from MonitorService.evaluateAll — alerting is observability, not
 * a hard dependency. Every call site wraps with .catch(noop).
 */

export interface MonitorAlertInput {
  monitor: {
    id: string;
    name: string;
    alertWebhookUrl: string | null;
    alertEmail: string | null;
    workflowId: string;
  };
  reason: string;
  /**
   * Optional branding line shown in the email body + Slack attachment.
   * Callers can inject the tenant name or runbook name here without
   * the service having to look them up.
   */
  contextLine?: string;
}

export interface MonitorAlertResult {
  /** True when at least one channel accepted the alert. */
  delivered: boolean;
  channels: {
    slack?: 'skipped' | 'sent' | 'failed';
    email?: 'skipped' | 'sent' | 'failed';
  };
}

export class MonitorAlertService {
  /**
   * Override point for tests. Real deploys use global fetch; tests
   * inject a jest.fn() so we can assert the POST body without a
   * network round-trip.
   */
  constructor(private readonly fetchFn: typeof fetch = fetch) {}

  async fire(input: MonitorAlertInput): Promise<MonitorAlertResult> {
    const result: MonitorAlertResult = { delivered: false, channels: {} };

    if (input.monitor.alertWebhookUrl) {
      const ok = await this.sendSlack(input);
      result.channels.slack = ok ? 'sent' : 'failed';
      if (ok) result.delivered = true;
    }

    if (input.monitor.alertEmail) {
      const ok = await this.sendEmail(input);
      result.channels.email = ok ? 'sent' : 'failed';
      if (ok) result.delivered = true;
    }

    return result;
  }

  private async sendSlack(input: MonitorAlertInput): Promise<boolean> {
    const url = input.monitor.alertWebhookUrl!;
    const body = {
      text: `🚨 Monitor *${input.monitor.name}* is FIRING`,
      attachments: [
        {
          color: '#d64541',
          text: input.reason,
          ...(input.contextLine ? { footer: input.contextLine } : {}),
        },
      ],
    };
    try {
      const res = await this.fetchFn(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        logger.warn(
          { monitorId: input.monitor.id, status: res.status },
          'monitor alert slack POST non-2xx'
        );
        return false;
      }
      return true;
    } catch (err) {
      logger.warn({ err, monitorId: input.monitor.id }, 'monitor alert slack POST threw');
      return false;
    }
  }

  private async sendEmail(input: MonitorAlertInput): Promise<boolean> {
    try {
      const result = await sendEmail({
        to: input.monitor.alertEmail!,
        subject: `[NanoRun] Monitor "${input.monitor.name}" is FIRING`,
        text:
          `Monitor: ${input.monitor.name}\n` +
          `Reason: ${input.reason}\n` +
          (input.contextLine ? `\n${input.contextLine}\n` : '') +
          `\nOpen in NanoRun to acknowledge or silence.`,
      });
      // `loggedOnly` means no provider was configured — the body was
      // written to stdout. Treat as delivered: the operator still gets
      // the alert in their log stream (`docker logs`).
      return result.delivered || result.loggedOnly === true;
    } catch (err) {
      logger.warn({ err, monitorId: input.monitor.id }, 'monitor alert email send threw');
      return false;
    }
  }
}
