import { ErrorCode, ExternalServiceError } from '../../errors/custom-error';
import type { EmailNodeConfig, EmailResult, ExecutionInput } from '../../types/runbook.types';
import { withExternalServiceRetry } from '../../utils/retry';
import type {
  EditorNodeExecutor,
  EmailTransporterLike,
  NodeErrorContext,
  NodeExecutorDeps,
} from './_shared';
import { resolveTemplate } from './_shared';

/**
 * Email node — sends a message via the configured nodemailer transporter.
 *
 * Behavior preserved exactly from the legacy `executeEmail` method:
 *   - Throws ExternalServiceError(EMAIL_NOT_CONFIGURED) when no
 *     transporter is wired (SMTP_HOST unset). NOT retryable.
 *   - withExternalServiceRetry handles transient failures with
 *     maxRetries = 2
 *   - From address comes from process.env.SMTP_USER (preserved as a
 *     side effect dependency on env — moving it would change behavior)
 *   - Resolves {{templates}} in to/subject/body/html
 *   - Returns nodemailer's messageId / accepted / rejected as-is
 *
 * The transporter is injected via a getter (deps.getEmailTransporter)
 * so the executor can be constructed before SMTP env vars are read,
 * and so tests can swap the transporter at runtime.
 */
export class EmailNodeExecutor implements EditorNodeExecutor<EmailNodeConfig, EmailResult> {
  readonly type = 'Email';
  readonly aliases = ['custom.email'] as const;

  constructor(
    private readonly deps: Pick<NodeExecutorDeps, 'logger'> & {
      getEmailTransporter: () => EmailTransporterLike | null;
    }
  ) {}

  async execute(
    config: EmailNodeConfig,
    input: ExecutionInput,
    errorContext: NodeErrorContext
  ): Promise<EmailResult> {
    const transporter = this.deps.getEmailTransporter();
    if (!transporter) {
      throw new ExternalServiceError({
        ...errorContext,
        message: 'Email service is not configured',
        code: ErrorCode.EMAIL_NOT_CONFIGURED,
        serviceName: 'Email',
        userMessage: 'Email service is not available at this time',
        isRetryable: false,
      });
    }

    const { to, subject, body, html } = config;

    const resolvedTo = resolveTemplate(to || '', input);
    const resolvedSubject = resolveTemplate(subject || '', input);
    const resolvedBody = resolveTemplate(body || '', input);
    const resolvedHtml = html ? resolveTemplate(html, input) : undefined;

    try {
      const info = await withExternalServiceRetry(
        async () => {
          return await transporter.sendMail({
            from: process.env.SMTP_USER,
            to: resolvedTo,
            subject: resolvedSubject,
            text: resolvedBody,
            html: resolvedHtml,
          });
        },
        'Email Service',
        { maxRetries: 2 }
      );

      return {
        messageId: info.messageId,
        accepted: info.accepted as string[],
        rejected: info.rejected as string[],
      };
    } catch (error) {
      const emailError =
        error instanceof ExternalServiceError
          ? error
          : new ExternalServiceError({
              message: error instanceof Error ? error.message : 'Failed to send email',
              code: ErrorCode.EMAIL_SEND_FAILED,
              serviceName: 'Email',
              cause: error instanceof Error ? error : undefined,
            });

      this.deps.logger.error('Email sending failed', {
        error: emailError,
        metadata: { to: resolvedTo },
      });

      throw emailError;
    }
  }
}
