import { AuditService } from '../../audit/audit.service';
import { logger } from '../../config/logger.config';
import { blockedTarget } from '../../security/ssrf-guard';
import { sendEmail } from '../../services/email.service';
import { renderApprovalRequestEmail } from '../../services/email-templates';

const TIMEOUT_MS = 5000;

export interface ApprovalTargets {
  emails: string[];
  slackWebhookUrl?: string;
  telegram?: { botToken: string; chatId: string };
}

export interface ApprovalNotice {
  approvalId: string;
  runbookName: string;
  message: string;
  escalated: boolean;
}

export type ChannelResult = 'sent' | 'logged' | 'failed';

export interface NotifyResult {
  email?: Record<string, ChannelResult>;
  slack?: ChannelResult;
  telegram?: ChannelResult;
}

export function hasTargets(targets: ApprovalTargets): boolean {
  return targets.emails.length > 0 || !!targets.slackWebhookUrl || !!targets.telegram;
}

/**
 * The link only opens the inbox: approving still needs a session, so role and
 * MFA apply, chat link previews cannot approve, and anyone reading the channel
 * cannot either.
 */
export function approvalUrl(approvalId: string): string {
  const base = (process.env.FRONTEND_URL ?? 'http://localhost:3000').split(',')[0].trim();
  return `${base.replace(/\/$/, '')}/inbox?approval=${encodeURIComponent(approvalId)}`;
}

async function post(url: string, body: unknown): Promise<ChannelResult> {
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      redirect: 'error',
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    return res.ok ? 'sent' : 'failed';
  } catch {
    return 'failed';
  }
}

export class ApprovalNotifier {
  async send(notice: ApprovalNotice, targets: ApprovalTargets): Promise<NotifyResult> {
    const [email, slack, telegram] = await Promise.all([
      this.sendEmails(notice, targets.emails),
      targets.slackWebhookUrl ? this.sendSlack(notice, targets.slackWebhookUrl) : undefined,
      targets.telegram ? this.sendTelegram(notice, targets.telegram) : undefined,
    ]);
    return {
      ...(email ? { email } : {}),
      ...(slack ? { slack } : {}),
      ...(telegram ? { telegram } : {}),
    };
  }

  private async sendEmails(notice: ApprovalNotice, emails: string[]) {
    if (emails.length === 0) return undefined;
    const rendered = renderApprovalRequestEmail({ ...notice, url: approvalUrl(notice.approvalId) });
    const entries = await Promise.all(
      emails.map(async (to): Promise<[string, ChannelResult]> => {
        const result = await sendEmail({ to, ...rendered }).catch(() => null);
        if (!result) return [to, 'failed'];
        if (result.loggedOnly) return [to, 'logged'];
        return [to, result.delivered ? 'sent' : 'failed'];
      })
    );
    return Object.fromEntries(entries);
  }

  private async sendSlack(notice: ApprovalNotice, url: string): Promise<ChannelResult> {
    if (!url.startsWith('https://') || (await blockedTarget('url', url))) return 'failed';
    const heading = headingFor(notice);
    return post(url, {
      text: `${heading}: ${notice.runbookName}`,
      blocks: [
        { type: 'header', text: { type: 'plain_text', text: heading } },
        {
          type: 'section',
          text: { type: 'plain_text', text: `${notice.runbookName}\n${notice.message}`.slice(0, 2900) },
        },
        {
          type: 'actions',
          elements: [
            {
              type: 'button',
              style: 'primary',
              text: { type: 'plain_text', text: 'Review' },
              url: approvalUrl(notice.approvalId),
            },
          ],
        },
      ],
    });
  }

  private sendTelegram(
    notice: ApprovalNotice,
    target: NonNullable<ApprovalTargets['telegram']>
  ): Promise<ChannelResult> {
    return post(`https://api.telegram.org/bot${target.botToken}/sendMessage`, {
      chat_id: target.chatId,
      text: `${headingFor(notice)}\n${notice.runbookName}\n\n${notice.message}`.slice(0, 4096),
      reply_markup: {
        inline_keyboard: [[{ text: 'Review', url: approvalUrl(notice.approvalId) }]],
      },
    });
  }
}

function headingFor(notice: ApprovalNotice): string {
  return notice.escalated ? 'Escalated: approval still waiting' : 'Approval needed';
}

/** Delivery failures are recorded, never thrown: the inbox still has the request. */
export async function announceApproval(params: {
  notifier: ApprovalNotifier;
  audit: AuditService | null;
  notice: ApprovalNotice;
  targets: ApprovalTargets;
  tenantId?: string;
  executionId: string;
}): Promise<void> {
  const { notifier, audit, notice, targets, tenantId, executionId } = params;
  try {
    const channels = await notifier.send(notice, targets);
    if (audit && tenantId) {
      await audit.record({
        tenantId,
        type: notice.escalated ? 'approval.escalated' : 'approval.notified',
        actorId: 'system',
        actorType: 'system',
        resource: executionId,
        payload: { approvalId: notice.approvalId, executionId, channels },
      });
    }
  } catch (err) {
    logger.error({ err, approvalId: notice.approvalId }, 'Approval notification failed');
  }
}
