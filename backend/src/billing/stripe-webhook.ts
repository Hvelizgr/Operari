import { createHmac, timingSafeEqual } from 'crypto';

/**
 * Verify a Stripe webhook signature without pulling the SDK.
 *
 * Stripe signs the raw request body + a timestamp with the endpoint
 * secret: the header looks like `t=123,v1=abc...`. To verify we:
 *   1. Parse the header into { t, v1, v0 }.
 *   2. Reconstruct the signed payload: `<t>.<raw body>`.
 *   3. HMAC-SHA-256 the payload with the endpoint secret.
 *   4. Compare against v1 in constant time.
 *   5. Reject if the timestamp is older than `toleranceSeconds`.
 *
 * The handler MUST receive the raw body byte-for-byte. We already
 * capture `req.rawBody` in server.ts' express.json verify hook for
 * the webhook routes that need it, so this module consumes `Buffer`.
 */

const SIGNATURE_HEADER = 'stripe-signature';
const DEFAULT_TOLERANCE_SECONDS = 5 * 60; // 5 minutes

export class StripeSignatureError extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'StripeSignatureError';
    }
}

interface ParsedSignature {
    timestamp: number;
    v1Signatures: string[];
}

function parseSignatureHeader(header: string): ParsedSignature {
    const pairs = header.split(',').map((p) => p.trim());
    let timestamp = 0;
    const v1Signatures: string[] = [];
    for (const pair of pairs) {
        const [k, v] = pair.split('=');
        if (!k || !v) continue;
        if (k === 't') {
            timestamp = Number(v);
        } else if (k === 'v1') {
            v1Signatures.push(v);
        }
    }
    if (!timestamp || v1Signatures.length === 0) {
        throw new StripeSignatureError('signature header missing t or v1');
    }
    return { timestamp, v1Signatures };
}

function safeEquals(a: string, b: string): boolean {
    if (a.length !== b.length) return false;
    return timingSafeEqual(Buffer.from(a), Buffer.from(b));
}

export interface VerifyWebhookOptions {
    secret: string;
    header: string;
    rawBody: Buffer | string;
    toleranceSeconds?: number;
    /** Injected for tests. Defaults to Date.now(). */
    now?: () => number;
}

export function verifyStripeWebhook(options: VerifyWebhookOptions): void {
    const { secret, header, rawBody } = options;
    const tolerance = options.toleranceSeconds ?? DEFAULT_TOLERANCE_SECONDS;
    const now = options.now ?? (() => Date.now());

    const parsed = parseSignatureHeader(header);
    const payload = `${parsed.timestamp}.${typeof rawBody === 'string' ? rawBody : rawBody.toString('utf8')}`;
    const expected = createHmac('sha256', secret).update(payload).digest('hex');

    const match = parsed.v1Signatures.some((sig) => safeEquals(expected, sig));
    if (!match) {
        throw new StripeSignatureError('signature mismatch');
    }

    const ageSeconds = Math.abs(Math.floor(now() / 1000) - parsed.timestamp);
    if (ageSeconds > tolerance) {
        throw new StripeSignatureError(`timestamp outside tolerance (age=${ageSeconds}s)`);
    }
}
