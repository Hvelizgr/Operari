import { Router, type Request, type Response } from 'express';
import { z } from 'zod';
import { logger } from '../config/logger.config';

const router = Router();

/**
 * Marketing contact form receiver.
 *
 * Pre-launch there is no CRM + no email provider wired, so this route
 * logs the submission to the structured logger so it lands in the
 * ops inbox (via log aggregation) and returns a friendly ack. When a
 * provider (Postmark, Resend, or a Linear issue creator) ships, swap
 * the body of the handler for the real send. The public contract stays
 * the same, so the frontend does not need to change.
 *
 * Rate-limited by the same `standardRateLimiter` the rest of /api uses,
 * plus a hard per-submission schema check so bots that POST raw JSON
 * without the required fields get a 400 cheap.
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

router.post('/', (req: Request, res: Response) => {
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

    logger.info(
        { name, email, company: company || null, messageLength: message.length },
        'contact.submission',
    );

    return res.status(202).json({
        ok: true,
        message: 'Got it. We will reply within 48 hours.',
    });
});

export default router;
