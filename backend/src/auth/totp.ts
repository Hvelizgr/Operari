import { createHmac, randomBytes, timingSafeEqual } from 'crypto';

/**
 * Pure-Node TOTP (RFC 6238) + HOTP (RFC 4226) helpers.
 *
 * Implemented directly against node:crypto so MFA doesn't drag in
 * `speakeasy`/`otplib`. 40 lines, a couple of golden vectors, and
 * full control over the timing-safe comparison is worth more than
 * an npm dep for something this small.
 *
 * Parameters are locked to authenticator-app defaults (SHA1, 6
 * digits, 30-second period) because that's what Google Authenticator,
 * 1Password, Authy, and Raycast all default to. The otpauth URL we
 * emit explicitly lists them so there's no room for interpretation.
 */

const PERIOD_SECONDS = 30;
const DIGITS = 6;
const ALGORITHM = 'SHA1';
const SECRET_BYTES = 20; // 160 bits — RFC 6238 recommended minimum

const BASE32_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

/**
 * Encode a Buffer to RFC 4648 base32 (no padding is fine for TOTP
 * secrets — authenticator apps accept both).
 */
export function base32Encode(buf: Buffer): string {
    let bits = 0;
    let value = 0;
    let output = '';
    for (const byte of buf) {
        value = (value << 8) | byte;
        bits += 8;
        while (bits >= 5) {
            output += BASE32_ALPHABET[(value >>> (bits - 5)) & 0x1f];
            bits -= 5;
        }
    }
    if (bits > 0) {
        output += BASE32_ALPHABET[(value << (5 - bits)) & 0x1f];
    }
    return output;
}

export function base32Decode(str: string): Buffer {
    const clean = str.toUpperCase().replace(/[^A-Z2-7]/g, '');
    let bits = 0;
    let value = 0;
    const bytes: number[] = [];
    for (const char of clean) {
        const idx = BASE32_ALPHABET.indexOf(char);
        if (idx === -1) throw new Error('Invalid base32 character');
        value = (value << 5) | idx;
        bits += 5;
        if (bits >= 8) {
            bytes.push((value >>> (bits - 8)) & 0xff);
            bits -= 8;
        }
    }
    return Buffer.from(bytes);
}

/**
 * Generate a fresh 160-bit secret, base32-encoded. This is what the
 * user scans into their authenticator app.
 */
export function generateTotpSecret(): string {
    return base32Encode(randomBytes(SECRET_BYTES));
}

/**
 * Build the `otpauth://` URL authenticator apps scan. RFC 6238 uses
 * the label `Issuer:Account` and duplicates Issuer in a query param
 * because older apps parsed one or the other, not both.
 */
export function buildOtpauthUrl(params: {
    secret: string;
    accountName: string;
    issuer?: string;
}): string {
    const issuer = params.issuer ?? 'Cairn';
    const label = encodeURIComponent(`${issuer}:${params.accountName}`);
    const qs = new URLSearchParams({
        secret: params.secret,
        issuer,
        algorithm: ALGORITHM,
        digits: String(DIGITS),
        period: String(PERIOD_SECONDS),
    });
    return `otpauth://totp/${label}?${qs.toString()}`;
}

/**
 * HOTP per RFC 4226 — counter-based. TOTP is HOTP with counter =
 * floor(now / period).
 */
function hotp(secret: Buffer, counter: number): string {
    const counterBuf = Buffer.alloc(8);
    // Counters up to 2^53 are safely representable in JS number; we
    // won't hit that in this century.
    counterBuf.writeBigUInt64BE(BigInt(counter));
    const hmac = createHmac('sha1', secret).update(counterBuf).digest();
    // Dynamic truncation: offset is the low nibble of the last byte.
    const offset = hmac[hmac.length - 1] & 0x0f;
    const binary =
        ((hmac[offset] & 0x7f) << 24) |
        ((hmac[offset + 1] & 0xff) << 16) |
        ((hmac[offset + 2] & 0xff) << 8) |
        (hmac[offset + 3] & 0xff);
    const code = binary % 10 ** DIGITS;
    return code.toString().padStart(DIGITS, '0');
}

/**
 * Compute the TOTP code for `now` (ms since epoch). Exposed for
 * tests; production callers should use verifyTotp().
 */
export function generateTotp(secret: string, now: number = Date.now()): string {
    const counter = Math.floor(now / 1000 / PERIOD_SECONDS);
    return hotp(base32Decode(secret), counter);
}

/**
 * Verify a user-provided code against the current counter, plus one
 * step of clock drift in either direction. Returns true on match.
 * Timing-safe so we don't leak info via response-time side channels.
 */
export function verifyTotp(
    secret: string,
    code: string,
    now: number = Date.now(),
): boolean {
    if (!/^\d{6}$/.test(code)) return false;
    const decoded = base32Decode(secret);
    const baseCounter = Math.floor(now / 1000 / PERIOD_SECONDS);
    const candidateBuf = Buffer.from(code, 'utf8');
    for (const drift of [-1, 0, 1]) {
        const candidate = hotp(decoded, baseCounter + drift);
        const cBuf = Buffer.from(candidate, 'utf8');
        if (cBuf.length === candidateBuf.length && timingSafeEqual(cBuf, candidateBuf)) {
            return true;
        }
    }
    return false;
}
