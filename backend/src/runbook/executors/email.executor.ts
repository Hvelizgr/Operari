import nodemailer from 'nodemailer';

import { blockedTarget } from '../../security/ssrf-guard';
import {
  ExecutorContext,
  ExecutorResult,
  resolveTemplate,
  StepExecutor,
} from '../types/executor.types';

export interface EmailConfig {
  /**
   * smtp(s)://user:pass@host:port — usually `{{secrets.<id>}}`. Empty
   * falls back to the deployment's SMTP_* settings.
   */
  smtpUrl?: string;
  from?: string;
  /** Comma-separated recipients. */
  to: string;
  subject: string;
  body: string;
}

type Transport = Pick<nodemailer.Transporter, 'sendMail'>;

/** Email over SMTP — for stakeholders who are not in the chat channel. */
export class EmailExecutor implements StepExecutor<EmailConfig> {
  readonly type = 'email.send';

  constructor(
    private readonly createTransport: (url: string | undefined) => Transport | null = url => {
      if (url) return nodemailer.createTransport(url);
      if (!process.env.SMTP_HOST) return null;
      return nodemailer.createTransport({
        host: process.env.SMTP_HOST,
        port: Number(process.env.SMTP_PORT ?? 587),
        secure: process.env.SMTP_SECURE === 'true',
        auth: process.env.SMTP_USER
          ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
          : undefined,
      });
    }
  ) {}

  async execute(config: EmailConfig, context: ExecutorContext): Promise<ExecutorResult> {
    const startTime = Date.now();
    const r = (v?: string) => resolveTemplate(v ?? '', context);
    const fail = (error: string): ExecutorResult => ({
      success: false,
      error,
      duration: Date.now() - startTime,
    });
    const to = r(config.to);
    const subject = r(config.subject);
    const smtpUrl = r(config.smtpUrl);
    if (!to) return fail('to is required');
    if (!subject) return fail('subject is required');
    if (smtpUrl && !/^smtps?:\/\//.test(smtpUrl))
      return fail('smtpUrl must start with smtp:// or smtps://');

    if (smtpUrl) {
      let smtpHost: string;
      try {
        smtpHost = new URL(smtpUrl).hostname;
      } catch {
        return fail('smtpUrl is not a valid URL');
      }
      const blocked = await blockedTarget('host', smtpHost);
      if (blocked) return fail(`email: ${blocked}`);
    }

    context.emit?.({ type: 'log', text: `email to ${to} — ${subject}`, timestamp: new Date() });
    if (context.dryRun) {
      context.emit?.({ type: 'log', text: `[dry-run] would email ${to}`, timestamp: new Date() });
      return {
        success: true,
        output: { dryRun: true, to, subject },
        duration: Date.now() - startTime,
      };
    }

    const transport = this.createTransport(smtpUrl || undefined);
    if (!transport)
      return fail('no SMTP server: set smtpUrl or the SMTP_HOST environment variable');
    try {
      const info = await transport.sendMail({
        // On the platform's SMTP a tenant-chosen From would make it an open
        // relay for spoofed mail; only a tenant's own server may set it.
        from:
          (smtpUrl ? r(config.from) : '') ||
          process.env.SMTP_FROM ||
          process.env.SMTP_USER ||
          'operari@localhost',
        to,
        subject,
        text: r(config.body),
      });
      return {
        success: true,
        output: { messageId: info.messageId, accepted: info.accepted, rejected: info.rejected },
        duration: Date.now() - startTime,
      };
    } catch (err) {
      return fail(`email: ${err instanceof Error ? err.message : String(err)}`);
    }
  }
}
