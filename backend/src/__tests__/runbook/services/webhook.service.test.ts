import crypto from 'crypto';
import type { PrismaClient } from '@prisma/client';
import { WebhookService } from '../../../runbook/services/webhook.service';

/**
 * Tests for WebhookService.verifySignature.
 *
 * History: an earlier version of this code took `JSON.stringify(req.body)`
 * as the rawBody input. That is the canonical webhook bug — Express's
 * json parser does not preserve byte-for-byte the original payload, so
 * HMAC verification fails randomly in production. The test
 * "rejects when payload bytes differ from what was signed (the trap)"
 * pins the fix.
 */

const SECRET = 'a-shared-secret-known-to-both-sides';

function signGitHub(secret: string, body: Buffer | string): string {
    const buf = Buffer.isBuffer(body) ? body : Buffer.from(body, 'utf8');
    const hex = crypto.createHmac('sha256', secret).update(buf).digest('hex');
    return `sha256=${hex}`;
}

function buildService(): WebhookService {
    // verifySignature does not touch prisma; pass an empty object cast.
    return new WebhookService({} as PrismaClient);
}

describe('WebhookService.verifySignature', () => {
    let svc: WebhookService;

    beforeEach(() => {
        svc = buildService();
    });

    describe('happy path', () => {
        it('accepts a valid GitHub signature over the exact bytes', () => {
            const body = Buffer.from('{"action":"opened","number":42}', 'utf8');
            const sig = signGitHub(SECRET, body);
            expect(svc.verifySignature(SECRET, body, sig, 'github')).toBe(true);
        });

        it('accepts a string rawBody (utf8 encoded internally)', () => {
            const body = '{"action":"opened","number":42}';
            const sig = signGitHub(SECRET, body);
            expect(svc.verifySignature(SECRET, body, sig, 'github')).toBe(true);
        });

        it('accepts the generic format without sha256= prefix', () => {
            const body = Buffer.from('{"x":1}', 'utf8');
            const hex = crypto.createHmac('sha256', SECRET).update(body).digest('hex');
            // Generic source = no prefix expected, but the verifier accepts
            // sha256= for ANY source so this also tests the case-insensitive
            // strip.
            expect(svc.verifySignature(SECRET, body, hex, 'custom')).toBe(true);
        });

        it('case-insensitive sha256= prefix strip', () => {
            const body = Buffer.from('{"x":1}', 'utf8');
            const hex = crypto.createHmac('sha256', SECRET).update(body).digest('hex');
            expect(svc.verifySignature(SECRET, body, `SHA256=${hex}`, 'github')).toBe(true);
        });
    });

    describe('rejection paths', () => {
        it('rejects when the signature header is missing', () => {
            const body = Buffer.from('{"x":1}', 'utf8');
            expect(svc.verifySignature(SECRET, body, undefined, 'github')).toBe(false);
        });

        it('rejects when the rawBody is undefined (the bug guard)', () => {
            // This is the canary that catches the regression where a
            // route forgets to pass req.rawBody. Verifier MUST refuse
            // rather than silently signing an empty buffer.
            const sig = signGitHub(SECRET, '{"x":1}');
            expect(svc.verifySignature(SECRET, undefined, sig, 'github')).toBe(false);
        });

        it('rejects when the body bytes differ from what was signed (the trap)', () => {
            // GitHub sent {"action":"opened","number":42} and signed exactly
            // those bytes. Express parses the JSON, then a buggy verifier
            // re-serializes via JSON.stringify which produces the same
            // string in this case. But Express may also normalize whitespace
            // or key order under different parser versions. Worst case: a
            // payload with extra whitespace round-trips to a DIFFERENT
            // string and the HMAC fails.
            const sentBytes = Buffer.from('{ "action": "opened", "number": 42 }', 'utf8');
            const sig = signGitHub(SECRET, sentBytes);

            const reSerialized = JSON.stringify({ action: 'opened', number: 42 });
            // The re-serialized version produces a DIFFERENT byte sequence
            // (no spaces) so the signature MUST NOT validate against it.
            expect(svc.verifySignature(SECRET, reSerialized, sig, 'github')).toBe(false);
            // But it MUST validate against the original bytes:
            expect(svc.verifySignature(SECRET, sentBytes, sig, 'github')).toBe(true);
        });

        it('rejects a tampered body', () => {
            const body = Buffer.from('{"action":"opened","number":42}', 'utf8');
            const sig = signGitHub(SECRET, body);
            const tampered = Buffer.from('{"action":"opened","number":99}', 'utf8');
            expect(svc.verifySignature(SECRET, tampered, sig, 'github')).toBe(false);
        });

        it('rejects when the secret is wrong', () => {
            const body = Buffer.from('{"x":1}', 'utf8');
            const sig = signGitHub(SECRET, body);
            expect(svc.verifySignature('different-secret', body, sig, 'github')).toBe(false);
        });

        it('rejects a signature with the wrong length without throwing', () => {
            const body = Buffer.from('{"x":1}', 'utf8');
            // Provide a signature that is too short to be a sha256 hex
            // — the timingSafeEqual call would otherwise throw on
            // length mismatch, leaking info via the exception path.
            expect(svc.verifySignature(SECRET, body, 'sha256=deadbeef', 'github')).toBe(false);
        });

        it('rejects when the provided signature is not valid hex', () => {
            const body = Buffer.from('{"x":1}', 'utf8');
            const validHex = crypto.createHmac('sha256', SECRET).update(body).digest('hex');
            // Replace last char with non-hex
            const garbage = `sha256=${validHex.slice(0, -1)}Z`;
            expect(svc.verifySignature(SECRET, body, garbage, 'github')).toBe(false);
        });
    });

    describe('timing-safe', () => {
        it('returns false (not throws) on every rejection path so timing leaks are bounded', () => {
            const body = Buffer.from('{"x":1}', 'utf8');
            // The implementation MUST never throw on a malformed
            // signature — exceptions take a different code path and
            // can be observed via response time. Pin the contract by
            // probing several bad inputs.
            const cases: Array<string | undefined> = [
                undefined,
                '',
                'not-a-signature',
                'sha256=',
                'sha256=zzz',
                'a'.repeat(64),
                'sha256=' + 'f'.repeat(63),
            ];
            for (const probe of cases) {
                expect(() =>
                    svc.verifySignature(SECRET, body, probe, 'github'),
                ).not.toThrow();
                expect(svc.verifySignature(SECRET, body, probe, 'github')).toBe(false);
            }
        });
    });
});
