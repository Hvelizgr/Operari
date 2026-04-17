import {
    base32Decode,
    base32Encode,
    buildOtpauthUrl,
    generateTotp,
    generateTotpSecret,
    verifyTotp,
} from '../../auth/totp';

/**
 * RFC 6238 golden vectors pin the HOTP/TOTP math. These are the
 * sample values from Appendix B of the RFC (20-byte ASCII key
 * "12345678901234567890" with the SHA-1 algorithm, 8-digit output).
 * Our implementation truncates to 6 digits, so we compute the
 * expected 6-digit slice by taking the last 6 digits of each
 * published value.
 *
 * Times (from RFC):
 *   T = 59          → 94287082  → 287082
 *   T = 1111111109  → 07081804  → 081804
 *   T = 1111111111  → 14050471  → 050471
 *   T = 1234567890  → 89005924  → 005924
 */

const RFC_KEY_B32 = base32Encode(Buffer.from('12345678901234567890'));

describe('base32 encode/decode', () => {
    it('round-trips a random buffer', () => {
        const buf = Buffer.from('the quick brown fox jumps over the lazy dog');
        const encoded = base32Encode(buf);
        const decoded = base32Decode(encoded);
        expect(decoded.equals(buf)).toBe(true);
    });

    it('strips unexpected characters silently (matches standard base32 parsers)', () => {
        // `!!!!` has no base32 chars → empty buffer (documented behavior).
        // This doubles as documentation: upstream input should already be clean;
        // the strip is a permissive fallback, not validation.
        expect(base32Decode('!!!!').length).toBe(0);
    });
});

describe('generateTotp (RFC 6238 golden vectors)', () => {
    const vectors: Array<{ time: number; expected: string }> = [
        { time: 59 * 1000, expected: '287082' },
        { time: 1111111109 * 1000, expected: '081804' },
        { time: 1111111111 * 1000, expected: '050471' },
        { time: 1234567890 * 1000, expected: '005924' },
    ];

    for (const { time, expected } of vectors) {
        it(`produces ${expected} at T=${time / 1000}`, () => {
            expect(generateTotp(RFC_KEY_B32, time)).toBe(expected);
        });
    }
});

describe('verifyTotp', () => {
    const now = 1_700_000_000 * 1000;

    it('accepts the current code', () => {
        const code = generateTotp(RFC_KEY_B32, now);
        expect(verifyTotp(RFC_KEY_B32, code, now)).toBe(true);
    });

    it('accepts the previous step (clock drift tolerance)', () => {
        const past = now - 30_000;
        const code = generateTotp(RFC_KEY_B32, past);
        expect(verifyTotp(RFC_KEY_B32, code, now)).toBe(true);
    });

    it('accepts the next step (clock drift tolerance)', () => {
        const future = now + 30_000;
        const code = generateTotp(RFC_KEY_B32, future);
        expect(verifyTotp(RFC_KEY_B32, code, now)).toBe(true);
    });

    it('rejects a code more than one step off', () => {
        const wayPast = now - 120_000;
        const code = generateTotp(RFC_KEY_B32, wayPast);
        expect(verifyTotp(RFC_KEY_B32, code, now)).toBe(false);
    });

    it('rejects non-6-digit input without dereferencing secret', () => {
        expect(verifyTotp(RFC_KEY_B32, '1234', now)).toBe(false);
        expect(verifyTotp(RFC_KEY_B32, 'abcdef', now)).toBe(false);
    });
});

describe('generateTotpSecret', () => {
    it('returns a distinct base32 string each call', () => {
        const a = generateTotpSecret();
        const b = generateTotpSecret();
        expect(a).not.toBe(b);
        expect(a).toMatch(/^[A-Z2-7]+$/);
        expect(a.length).toBeGreaterThanOrEqual(32);
    });
});

describe('buildOtpauthUrl', () => {
    it('emits an otpauth URL with the expected fields', () => {
        const url = new URL(buildOtpauthUrl({ secret: 'ABCDEFGH', accountName: 'jane@acme.io' }));
        expect(url.protocol).toBe('otpauth:');
        expect(url.host).toBe('totp');
        expect(decodeURIComponent(url.pathname)).toBe('/Cairn:jane@acme.io');
        expect(url.searchParams.get('secret')).toBe('ABCDEFGH');
        expect(url.searchParams.get('issuer')).toBe('Cairn');
        expect(url.searchParams.get('algorithm')).toBe('SHA1');
        expect(url.searchParams.get('digits')).toBe('6');
        expect(url.searchParams.get('period')).toBe('30');
    });
});
