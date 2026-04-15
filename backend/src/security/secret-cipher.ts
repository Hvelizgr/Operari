import {
    createCipheriv,
    createDecipheriv,
    randomBytes,
    timingSafeEqual,
    createHash,
} from 'crypto';

/**
 * SecretCipher — at-rest encryption for sensitive blobs (OAuth tokens,
 * API credentials, runner secrets, …).
 *
 * Algorithm: AES-256-GCM (authenticated encryption, FIPS-approved, built
 * into Node's `crypto` module — no new dependency).
 *
 * Format (versioned to allow future migration to XChaCha20-Poly1305):
 *
 *     v1:<base64(nonce 12 B)>:<base64(ciphertext)>:<base64(tag 16 B)>
 *
 * Each ciphertext binds an optional `aad` (additional authenticated data),
 * which lets callers tie an encrypted blob to its owner — e.g. the user ID
 * or tenant ID — so a stolen ciphertext can't be re-pasted into another
 * row.
 *
 * Master key: 32 bytes, supplied via env `NANORUN_SECRET_KEY` as hex (64
 * chars) or base64 (44 chars). Generate with:
 *
 *     node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
 *
 * KEY ROTATION: re-encrypt all rows by reading them with the old key and
 * writing them back with a new SecretCipher instance. The version prefix
 * (`v1:`) lets us run two ciphers side-by-side during the migration.
 */
export class SecretCipher {
    private static readonly VERSION = 'v1';
    private static readonly ALGO = 'aes-256-gcm';
    private static readonly KEY_BYTES = 32;
    private static readonly NONCE_BYTES = 12;
    private static readonly TAG_BYTES = 16;

    private readonly key: Buffer;

    constructor(rawKey: Buffer | string) {
        this.key = SecretCipher.parseKey(rawKey);
    }

    /**
     * Encrypt a UTF-8 string. Returns the versioned compact format.
     * `aad` is bound to the ciphertext but stored separately by the caller.
     */
    encrypt(plaintext: string, aad?: string): string {
        const nonce = randomBytes(SecretCipher.NONCE_BYTES);
        const cipher = createCipheriv(SecretCipher.ALGO, this.key, nonce);
        if (aad) {
            cipher.setAAD(Buffer.from(aad, 'utf8'));
        }
        const ciphertext = Buffer.concat([
            cipher.update(plaintext, 'utf8'),
            cipher.final(),
        ]);
        const tag = cipher.getAuthTag();
        return [
            SecretCipher.VERSION,
            nonce.toString('base64'),
            ciphertext.toString('base64'),
            tag.toString('base64'),
        ].join(':');
    }

    /**
     * Decrypt a value previously produced by {@link encrypt}.
     * Throws if the version is unknown, the format is malformed, or the
     * authentication tag does not verify (tampering / wrong key / wrong
     * AAD).
     */
    decrypt(payload: string, aad?: string): string {
        const parts = payload.split(':');
        if (parts.length !== 4) {
            throw new SecretCipherError('Malformed ciphertext: expected 4 segments');
        }
        const [version, nonceB64, ciphertextB64, tagB64] = parts;
        if (version !== SecretCipher.VERSION) {
            throw new SecretCipherError(`Unsupported ciphertext version: ${version}`);
        }
        const nonce = Buffer.from(nonceB64, 'base64');
        const ciphertext = Buffer.from(ciphertextB64, 'base64');
        const tag = Buffer.from(tagB64, 'base64');
        if (nonce.length !== SecretCipher.NONCE_BYTES) {
            throw new SecretCipherError('Malformed ciphertext: bad nonce length');
        }
        if (tag.length !== SecretCipher.TAG_BYTES) {
            throw new SecretCipherError('Malformed ciphertext: bad tag length');
        }
        const decipher = createDecipheriv(SecretCipher.ALGO, this.key, nonce);
        if (aad) {
            decipher.setAAD(Buffer.from(aad, 'utf8'));
        }
        decipher.setAuthTag(tag);
        try {
            return Buffer.concat([
                decipher.update(ciphertext),
                decipher.final(),
            ]).toString('utf8');
        } catch (err) {
            throw new SecretCipherError(
                'Decryption failed (bad key, wrong AAD, or tampered ciphertext)',
                err,
            );
        }
    }

    /**
     * Quickly check whether a string looks like a SecretCipher payload.
     * Useful during migrations: rows still in plaintext won't match.
     */
    static isCiphertext(value: string): boolean {
        return typeof value === 'string' && value.startsWith(`${SecretCipher.VERSION}:`);
    }

    /**
     * Stable, non-reversible fingerprint of the master key, suitable for
     * audit logging ("which key encrypted this row?") without leaking it.
     */
    keyFingerprint(): string {
        return createHash('sha256').update(this.key).digest('hex').slice(0, 12);
    }

    /**
     * Constant-time string equality — exposed for tests and any caller
     * that needs to compare an encrypted token to an expected value.
     */
    static safeEquals(a: string, b: string): boolean {
        const bufA = Buffer.from(a, 'utf8');
        const bufB = Buffer.from(b, 'utf8');
        if (bufA.length !== bufB.length) return false;
        return timingSafeEqual(bufA, bufB);
    }

    private static parseKey(raw: Buffer | string): Buffer {
        if (Buffer.isBuffer(raw)) {
            if (raw.length !== SecretCipher.KEY_BYTES) {
                throw new SecretCipherError(
                    `Master key must be ${SecretCipher.KEY_BYTES} bytes, got ${raw.length}`,
                );
            }
            return raw;
        }
        if (typeof raw !== 'string' || raw.length === 0) {
            throw new SecretCipherError('Master key is required');
        }
        // Try hex first (64 chars), then base64 (44 chars).
        if (/^[0-9a-fA-F]{64}$/.test(raw)) {
            return Buffer.from(raw, 'hex');
        }
        const decoded = Buffer.from(raw, 'base64');
        if (decoded.length === SecretCipher.KEY_BYTES) {
            return decoded;
        }
        throw new SecretCipherError(
            'Master key must be 32 bytes encoded as hex (64 chars) or base64 (44 chars)',
        );
    }
}

export class SecretCipherError extends Error {
    constructor(message: string, public readonly cause?: unknown) {
        super(message);
        this.name = 'SecretCipherError';
    }
}

/**
 * Build a SecretCipher from `process.env.NANORUN_SECRET_KEY`.
 * Throws at startup if the key is missing or malformed — fail loud, not
 * silently store plaintext.
 */
export function secretCipherFromEnv(env: NodeJS.ProcessEnv = process.env): SecretCipher {
    const key = env.NANORUN_SECRET_KEY;
    if (!key) {
        throw new SecretCipherError(
            'NANORUN_SECRET_KEY is not set. Generate one with:\n' +
            '  node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'hex\'))"',
        );
    }
    return new SecretCipher(key);
}
