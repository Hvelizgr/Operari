import { Router, type Request, type Response } from 'express';
import { z } from 'zod';
import { logger } from '../config/logger.config';

const router = Router();

/**
 * Marketing contact form receiver.
 *
 * Two paths:
 *   1) Cloud / staging: RESEND_API_KEY is set, so we forward the
 *      submission to the Resend HTTP API. CONTACT_TO_EMAIL picks the
 *      inbox. The call is fire-and-forget: a 5s fetch timeout so a
 *      slow upstream never blocks the ack.
 *   2) Self-host / pre-provider: no RESEND_API_KEY, so we just log
 *      the submission with structured pino fields. The ops team picks
 *      it up through log aggregation.
 *
 * Either way the caller gets 202 + ok. Schema validation is the cheap
 * gate; a zod failure returns 400 with per-field issues. The honeypot
 * field is accepted silently and returns 204 so naive bots think they
 * won.
 *
 * Swap to Postmark or SES by replacing `sendViaResend` — the contract
 * (args + return) stays stable so callers and tests don't change.
 */
const ContactPayload = z.object({
    name: z.string().trim().min(1, 'name is required').max(120),
    email: z.string().trim().email('invalid email').max(200),
    company: z.string().trim().max(200).optional().default(''),
    message: z.string().trim().min(1, 'message is required').max(5000),
    // Honeypot. Bots fill every field; humans leave this blank. We
    // accept any string (so schema validation doesn't surface it as an
    // "error" that could tip off a sophisticated bot that we noticed),
    // then the handler 204s silently when it's non-empty.
    website: z.string().max(500).optional().default(''),
});

type ContactSubmission = {
    name: string;
    email: string;
    company: string;
    message: string;
};

/**
 * Send via Resend. Isolated in its own function so `contact.routes`
 * can be switched to Postmark/SES without touching the handler flow.
 *
 * The route handler awaits this with a short timeout. Errors are
 * logged and swallowed: the visitor still gets 202, because "email
 * to us failed" is our reliability problem, not theirs. The log line
 * has everything we need to recover the message out-of-band.
 */
async function sendViaResend(
    submission: ContactSubmission,
    apiKey: string,
): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
    const to = process.env.CONTACT_TO_EMAIL || 'hello@nanorun.dev';
    const from = process.env.CONTACT_FROM_EMAIL || 'contact@nanorun.dev';

    const subject = `[contact] ${submission.name}${submission.company ? ` · ${submission.company}` : ''}`;
    const text = [
        `From: ${submission.name} <${submission.email}>`,
        submission.company ? `Company: ${submission.company}` : null,
        '',
        submission.message,
    ]
        .filter((l) => l !== null)
        .join('\n');

    try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 5000);
        const res = await fetch('https://api.resend.com/emails', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${apiKey}`,
            },
            body: JSON.stringify({
                from,
                to: [to],
                reply_to: submission.email,
                subject,
                text,
            }),
            signal: controller.signal,
        });
        clearTimeout(timeout);

        if (!res.ok) {
            const body = await res.text().catch(() => '');
            return { ok: false, error: `resend_${res.status}: ${body.slice(0, 200)}` };
        }
        const json = (await res.json().catch(() => ({}))) as { id?: string };
        return { ok: true, id: json.id ?? '' };
    } catch (err) {
        return {
            ok: false,
            error: err instanceof Error ? err.message : String(err),
        };
    }
}

router.post('/', async (req: Request, res: Response) => {
    const parsed = ContactPayload.safeParse(req.body);
    if (!parsed.success) {
        return res.status(400).json({
            error: 'validation_failed',
            issues: parsed.error.issues.map((i) => ({ path: i.path.join('.'), message: i.message })),
        });
    }
    const { name, email, company, message, website } = parsed.data;

    if (website) {
        // Honeypot tripped. Return 204 so the bot thinks it worked.
        logger.warn({ email }, 'contact.honeypot_tripped');
        return res.status(204).end();
    }

    const submission: ContactSubmission = { name, email, company, message };

    const apiKey = process.env.RESEND_API_KEY;
    if (apiKey) {
        const result = await sendViaResend(submission, apiKey);
        if (result.ok) {
            logger.info(
                { email, company: company || null, provider: 'resend', providerId: result.id },
                'contact.submission.delivered',
            );
        } else {
            logger.error(
                { email, company: company || null, provider: 'resend', error: result.error },
                'contact.submission.delivery_failed',
            );
        }
    } else {
        logger.info(
            { name, email, company: company || null, messageLength: message.length },
            'contact.submission',
        );
    }

    return res.status(202).json({
        ok: true,
        message: 'Got it. We will reply within 48 hours.',
    });
});

export default router;
