import { Router, type Request, type Response } from 'express';
import { z } from 'zod';
import { logger } from '../config/logger.config';
import { sendEmail } from '../services/email.service';
import { renderContactForwardEmail } from '../services/email-templates';

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
    const tpl = renderContactForwardEmail({
        name: submission.name,
        fromEmail: submission.email,
        company: submission.company || null,
        message: submission.message,
    });
    const to = process.env.CONTACT_TO_EMAIL || 'hello@nanorun.dev';

    const result = await sendEmail({
        to,
        subject: tpl.subject,
        text: tpl.text,
        html: tpl.html,
        replyTo: email,
    });
    if (result.delivered && !result.loggedOnly) {
        logger.info(
            { email, company: company || null, providerId: result.providerId },
            'contact.submission.delivered',
        );
    } else if (!result.delivered) {
        logger.error(
            { email, company: company || null, error: result.error },
            'contact.submission.delivery_failed',
        );
    }

    return res.status(202).json({
        ok: true,
        message: 'Got it. We will reply within 48 hours.',
    });
});

export default router;
