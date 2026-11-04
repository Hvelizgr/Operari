import nodemailer from 'nodemailer';

import { type FileRef, type FileStore, FileStoreError, isFileRef } from '../../files/file-store';
import { blockedTarget } from '../../security/ssrf-guard';
import {
  ExecutorContext,
  ExecutorResult,
  resolveTemplate,
  resolveValue,
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
  /**
   * Files from earlier steps: one expression ({{steps.x.output.file}}) or
   * several separated by commas or new lines; each may resolve to a file
   * or a list of files.
   */
  attachments?: string;
}

const MAX_ATTACHMENT_BYTES = 20 * 1024 * 1024;

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
    },
    private readonly files?: FileStore
  ) {}

  private async attachmentsFor(
    config: EmailConfig,
    context: ExecutorContext
  ): Promise<Array<{ filename: string; content: Buffer; contentType: string }>> {
    const raw = (config.attachments ?? '').trim();
    if (!raw) return [];
    if (!this.files) throw new FileStoreError('file storage is not available on this backend');
    const refs: FileRef[] = [];
    for (const piece of raw
      .split(/[\n,]+/)
      .map(p => p.trim())
      .filter(Boolean)) {
      const value = resolveValue(piece, context);
      for (const item of Array.isArray(value) ? value : [value]) {
        if (!isFileRef(item)) {
          throw new FileStoreError(`attachment "${piece}" is not a file from an earlier step`);
        }
        refs.push(item);
      }
    }
    const total = refs.reduce((n, f) => n + f.size, 0);
    if (total > MAX_ATTACHMENT_BYTES) {
      throw new FileStoreError(
        `attachments add up to ${total} bytes, over the ${MAX_ATTACHMENT_BYTES} limit`
      );
    }
    const out: Array<{ filename: string; content: Buffer; contentType: string }> = [];
    for (const ref of refs) {
      const { data } = await this.files.read(context.tenantId, ref.id);
      out.push({ filename: ref.name, content: data, contentType: ref.mimeType });
    }
    return out;
  }

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

    let attachments: Awaited<ReturnType<EmailExecutor['attachmentsFor']>>;
    try {
      attachments = await this.attachmentsFor(config, context);
    } catch (err) {
      return fail(`email: ${(err as Error).message}`);
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
        ...(attachments.length ? { attachments } : {}),
      });
      return {
        success: true,
        output: {
          messageId: info.messageId,
          accepted: info.accepted,
          rejected: info.rejected,
          attachments: attachments.map(a => a.filename),
        },
        duration: Date.now() - startTime,
      };
    } catch (err) {
      return fail(`email: ${err instanceof Error ? err.message : String(err)}`);
    }
  }
}
