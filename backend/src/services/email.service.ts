import { logger } from '../config/logger.config';

export interface EmailMessage {
  to: string;
  subject: string;
  /** Plain-text fallback. Always required: some clients (Gmail
   *  promotions filter, notification mirrors, terminal-based mail
   *  readers) surface the text part, so every template still needs
   *  a readable version even when `html` is also provided. */
  text: string;
  /** Optional HTML body. When present, Resend serves it as the
   *  primary body with `text` as the multipart fallback. */
  html?: string;
  replyTo?: string;
}

export interface SendResult {
  delivered: boolean;
  /** Present when the provider echoed an id (Resend returns this). */
  providerId?: string;
  /** Set when the provider call failed; the route keeps returning
   *  202 to the user but the server log has the detail. */
  error?: string;
  /** True when no provider is configured and we only logged. */
  loggedOnly?: boolean;
}

const RESEND_ENDPOINT = 'https://api.resend.com/emails';
const DEFAULT_TIMEOUT_MS = 5000;

function fromAddress(): string {
  return process.env.CONTACT_FROM_EMAIL || 'noreply@operari.dev';
}

async function sendViaResend(msg: EmailMessage, apiKey: string): Promise<SendResult> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT_MS);
  try {
    const res = await fetch(RESEND_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        from: fromAddress(),
        to: [msg.to],
        reply_to: msg.replyTo,
        subject: msg.subject,
        text: msg.text,
        ...(msg.html ? { html: msg.html } : {}),
      }),
      signal: controller.signal,
    });
    if (!res.ok) {
      const body = await res.text().catch(() => '');
      return { delivered: false, error: `resend_${res.status}: ${body.slice(0, 200)}` };
    }
    const json = (await res.json().catch(() => ({}))) as { id?: string };
    return { delivered: true, providerId: json.id };
  } catch (err) {
    return { delivered: false, error: err instanceof Error ? err.message : String(err) };
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * Send a transactional email, or log it when no provider is wired.
 *
 * Self-host deployments often have no Resend key. Rather than failing
 * the caller, we log the body so the operator can still see what went
 * out — useful for debugging password reset tokens locally and for
 * compliance trails.
 */
export async function sendEmail(msg: EmailMessage): Promise<SendResult> {
  const apiKey = process.env.RESEND_API_KEY;
  if (apiKey) {
    const result = await sendViaResend(msg, apiKey);
    if (result.delivered) {
      logger.info(
        { to: msg.to, subject: msg.subject, providerId: result.providerId },
        'email.sent'
      );
    } else {
      logger.error({ to: msg.to, subject: msg.subject, error: result.error }, 'email.send_failed');
    }
    return result;
  }
  logger.info({ to: msg.to, subject: msg.subject, body: msg.text }, 'email.log_only_no_provider');
  return { delivered: true, loggedOnly: true };
}
