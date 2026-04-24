import {
  createCipheriv,
  createDecipheriv,
  createHash,
  hkdfSync,
  randomBytes,
  timingSafeEqual,
} from 'crypto';

/**
 * SecretCipher — at-rest encryption for sensitive blobs (OAuth tokens,
 * API credentials, runner secrets, …).
 *
 * Algorithm: AES-256-GCM (authenticated encryption, FIPS-approved, built
 * into Node's `crypto` module — no new dependency).
 *
 * Two ciphertext formats, both versioned:
 *
 *   v1:<base64(nonce)>:<base64(ciphertext)>:<base64(tag)>
 *     Encrypted directly with the master key. Tenant isolation relies
 *     on AAD binding alone — a stolen key compromises every tenant at
 *     once. Kept for backward compatibility with existing rows.
 *
 *   v2:<base64(nonce)>:<base64(ciphertext)>:<base64(tag)>
 *     Encrypted with a per-tenant key derived from the master via
 *     HKDF-SHA256, salted for the "tenant KEK" domain and info'd with
 *     the tenantId. Leaking one tenant's ciphertext (or even the
 *     derived subkey) does NOT compromise other tenants' data. The
 *     master key is still required to derive new tenant keys, but the
 *     blast radius of a DB-only leak stays scoped to the cracked
 *     tenant. Requires a tenantId at both encrypt and decrypt time.
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
 * lets us run two ciphers side-by-side during the migration.
 */
export class SecretCipher {
  private static readonly VERSION_V1 = 'v1';
  private static readonly VERSION_V2 = 'v2';
  private static readonly ALGO = 'aes-256-gcm';
  private static readonly KEY_BYTES = 32;
  private static readonly NONCE_BYTES = 12;
  private static readonly TAG_BYTES = 16;
  /**
   * Domain-separator salt for the tenant-KEK HKDF. Bumping this string
   * is equivalent to a global key-rotation event: every tenant's
   * derived key changes. Only change it as part of a documented
   * rotation path — stored v2 ciphertexts derived under the old salt
   * become unreadable.
   */
  private static readonly TENANT_KEK_SALT = Buffer.from('nanorun-tenant-kek-v1', 'utf8');

  private readonly key: Buffer;
  /**
   * Optional legacy master keys that decrypt-only accepts. Populated
   * from `NANORUN_SECRET_KEY_LEGACY` when the operator is mid-rotation:
   * during the window, new writes go out under the current key but
   * old rows ciphered under the previous one still decrypt cleanly.
   * Once the KeyRotationService has re-encrypted every row, the
   * operator drops the env var on the next deploy.
   */
  private readonly legacyKeys: Buffer[];

  constructor(rawKey: Buffer | string, legacyKeys: Array<Buffer | string> = []) {
    this.key = SecretCipher.parseKey(rawKey);
    this.legacyKeys = legacyKeys.map(k => SecretCipher.parseKey(k));
  }

  /**
   * HKDF-SHA256 derivation of a 32-byte tenant KEK. Pure function of
   * (masterKey, TENANT_KEK_SALT, tenantId) — deterministic and cheap
   * (~100µs), so no caching is needed on the hot path.
   *
   * Exposed as a private helper so tests can assert both the encrypt
   * path and the derivation path against known vectors.
   */
  private deriveTenantKey(tenantId: string, master: Buffer = this.key): Buffer {
    if (!tenantId) {
      throw new SecretCipherError('tenantId is required for v2 encryption');
    }
    const info = Buffer.from(tenantId, 'utf8');
    // hkdfSync returns an ArrayBuffer; wrap it so Buffer APIs work.
    const derived = hkdfSync(
      'sha256',
      master,
      SecretCipher.TENANT_KEK_SALT,
      info,
      SecretCipher.KEY_BYTES
    );
    return Buffer.from(derived);
  }

  /** True when this cipher was constructed with at least one legacy
   *  key. The KeyRotationService uses this to decide whether any
   *  rows still need re-encryption. */
  hasLegacyKeys(): boolean {
    return this.legacyKeys.length > 0;
  }

  /**
   * Test whether a ciphertext decrypts under the PRIMARY master only
   * (legacy keys not considered). Used by KeyRotationService to
   * short-circuit no-op rewrites on resumed rotations: if a row is
   * already primary-owned, skip the Prisma update.
   *
   * Swallows the cipher error — returns false for any failure,
   * including the "wrong key" case this is designed to detect.
   */
  isCipheredUnderPrimary(payload: string, tenantId?: string, aad?: string): boolean {
    try {
      const parsed = SecretCipher.parseCiphertext(payload);
      if (parsed.version === SecretCipher.VERSION_V1) {
        SecretCipher.decryptBytes(this.key, parsed.nonce, parsed.ciphertext, parsed.tag, aad);
        return true;
      }
      if (parsed.version === SecretCipher.VERSION_V2) {
        if (!tenantId) return false;
        const key = this.deriveTenantKey(tenantId, this.key);
        SecretCipher.decryptBytes(key, parsed.nonce, parsed.ciphertext, parsed.tag, aad);
        return true;
      }
      return false;
    } catch {
      return false;
    }
  }

  /**
   * Encrypt a UTF-8 string with the master key (v1 format). Kept for
   * call sites that do not yet carry a tenantId in scope; new code
   * should prefer {@link encryptForTenant}.
   */
  encrypt(plaintext: string, aad?: string): string {
    return this.encryptWithKey(SecretCipher.VERSION_V1, this.key, plaintext, aad);
  }

  /**
   * Encrypt with a per-tenant derived key (v2 format). Leaking the
   * resulting ciphertext to another tenant's attacker does not give
   * them the plaintext — their tenantId derives a different key.
   */
  encryptForTenant(plaintext: string, tenantId: string, aad?: string): string {
    const key = this.deriveTenantKey(tenantId);
    return this.encryptWithKey(SecretCipher.VERSION_V2, key, plaintext, aad);
  }

  private encryptWithKey(version: string, key: Buffer, plaintext: string, aad?: string): string {
    const nonce = randomBytes(SecretCipher.NONCE_BYTES);
    const cipher = createCipheriv(SecretCipher.ALGO, key, nonce);
    if (aad) {
      cipher.setAAD(Buffer.from(aad, 'utf8'));
    }
    const ciphertext = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
    const tag = cipher.getAuthTag();
    return [
      version,
      nonce.toString('base64'),
      ciphertext.toString('base64'),
      tag.toString('base64'),
    ].join(':');
  }

  /**
   * Decrypt a v1 payload. Throws if the payload is v2 — the caller
   * doesn't have the tenantId in scope, which is a bug in the
   * migration path.
   */
  decrypt(payload: string, aad?: string): string {
    const { version, nonce, ciphertext, tag } = SecretCipher.parseCiphertext(payload);
    if (version !== SecretCipher.VERSION_V1) {
      throw new SecretCipherError(
        `Unsupported ciphertext version: ${version}. ` +
          (version === SecretCipher.VERSION_V2 ? 'Use decryptForTenant() with a tenantId.' : '')
      );
    }
    // Try current key first, then legacy keys (mid-rotation window).
    // Swallowing per-key failures is intentional — the only signal
    // the caller gets is "did ANY key decrypt it", same as before.
    try {
      return SecretCipher.decryptBytes(this.key, nonce, ciphertext, tag, aad);
    } catch (err) {
      for (const legacy of this.legacyKeys) {
        try {
          return SecretCipher.decryptBytes(legacy, nonce, ciphertext, tag, aad);
        } catch {
          /* try next */
        }
      }
      throw err;
    }
  }

  /**
   * Decrypt a v2 payload (per-tenant derived key). Also accepts v1
   * payloads transparently — convenient for migration paths where the
   * same column holds both formats side-by-side. The caller already
   * has the tenantId; passing it is cheap and silences v2 errors.
   */
  decryptForTenant(payload: string, tenantId: string, aad?: string): string {
    const { version, nonce, ciphertext, tag } = SecretCipher.parseCiphertext(payload);
    if (version === SecretCipher.VERSION_V1) {
      // v1 uses the master key directly — same dual-key fallback as
      // decrypt() above. Shared path would be nicer; kept inline so
      // the legacy-key ordering stays visible at each call site.
      try {
        return SecretCipher.decryptBytes(this.key, nonce, ciphertext, tag, aad);
      } catch (err) {
        for (const legacy of this.legacyKeys) {
          try {
            return SecretCipher.decryptBytes(legacy, nonce, ciphertext, tag, aad);
          } catch {
            /* try next */
          }
        }
        throw err;
      }
    }
    if (version === SecretCipher.VERSION_V2) {
      // v2 derives a per-tenant subkey from EACH master candidate.
      // Rotating the master changes every derived key, so a row
      // ciphered under the previous master derives under THAT master
      // at decrypt time.
      try {
        const key = this.deriveTenantKey(tenantId, this.key);
        return SecretCipher.decryptBytes(key, nonce, ciphertext, tag, aad);
      } catch (err) {
        for (const legacyMaster of this.legacyKeys) {
          try {
            const key = this.deriveTenantKey(tenantId, legacyMaster);
            return SecretCipher.decryptBytes(key, nonce, ciphertext, tag, aad);
          } catch {
            /* try next */
          }
        }
        throw err;
      }
    }
    throw new SecretCipherError(`Unsupported ciphertext version: ${version}`);
  }

  private static decryptBytes(
    key: Buffer,
    nonce: Buffer,
    ciphertext: Buffer,
    tag: Buffer,
    aad?: string
  ): string {
    const decipher = createDecipheriv(SecretCipher.ALGO, key, nonce);
    if (aad) {
      decipher.setAAD(Buffer.from(aad, 'utf8'));
    }
    decipher.setAuthTag(tag);
    try {
      return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString('utf8');
    } catch (err) {
      throw new SecretCipherError(
        'Decryption failed (bad key, wrong AAD, or tampered ciphertext)',
        err
      );
    }
  }

  private static parseCiphertext(payload: string): {
    version: string;
    nonce: Buffer;
    ciphertext: Buffer;
    tag: Buffer;
  } {
    const parts = payload.split(':');
    if (parts.length !== 4) {
      throw new SecretCipherError('Malformed ciphertext: expected 4 segments');
    }
    const [version, nonceB64, ciphertextB64, tagB64] = parts;
    const nonce = Buffer.from(nonceB64, 'base64');
    const ciphertext = Buffer.from(ciphertextB64, 'base64');
    const tag = Buffer.from(tagB64, 'base64');
    if (nonce.length !== SecretCipher.NONCE_BYTES) {
      throw new SecretCipherError('Malformed ciphertext: bad nonce length');
    }
    if (tag.length !== SecretCipher.TAG_BYTES) {
      throw new SecretCipherError('Malformed ciphertext: bad tag length');
    }
    return { version, nonce, ciphertext, tag };
  }

  /**
   * Quickly check whether a string looks like a SecretCipher payload
   * (either version). Useful during migrations: rows still in
   * plaintext won't match.
   */
  static isCiphertext(value: string): boolean {
    if (typeof value !== 'string') return false;
    return (
      value.startsWith(`${SecretCipher.VERSION_V1}:`) ||
      value.startsWith(`${SecretCipher.VERSION_V2}:`)
    );
  }

  /**
   * Reveals which version a ciphertext uses without decrypting it.
   * Returns null for strings that don't parse as ciphertext at all.
   */
  static versionOf(value: string): 'v1' | 'v2' | null {
    if (typeof value !== 'string') return null;
    if (value.startsWith(`${SecretCipher.VERSION_V1}:`)) return 'v1';
    if (value.startsWith(`${SecretCipher.VERSION_V2}:`)) return 'v2';
    return null;
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
          `Master key must be ${SecretCipher.KEY_BYTES} bytes, got ${raw.length}`
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
      'Master key must be 32 bytes encoded as hex (64 chars) or base64 (44 chars)'
    );
  }
}

export class SecretCipherError extends Error {
  constructor(
    message: string,
    public readonly cause?: unknown
  ) {
    super(message);
    this.name = 'SecretCipherError';
  }
}

/**
 * Build a SecretCipher from env. `NANORUN_SECRET_KEY` is the current
 * master (used for every encrypt + decrypt attempt first).
 * `NANORUN_SECRET_KEY_LEGACY` is optional; set it to the PREVIOUS
 * master during a rotation window so rows ciphered under the old key
 * still decrypt. Comma-separated to support chained rotations (newest
 * legacy first).
 *
 * Throws at startup if the primary key is missing or malformed —
 * fail loud, not silently store plaintext.
 */
export function secretCipherFromEnv(env: NodeJS.ProcessEnv = process.env): SecretCipher {
  const key = env.NANORUN_SECRET_KEY;
  if (!key) {
    throw new SecretCipherError(
      'NANORUN_SECRET_KEY is not set. Generate one with:\n' +
        "  node -e \"console.log(require('crypto').randomBytes(32).toString('hex'))\""
    );
  }
  const legacyRaw = env.NANORUN_SECRET_KEY_LEGACY;
  const legacyKeys = legacyRaw
    ? legacyRaw
        .split(',')
        .map(s => s.trim())
        .filter(s => s.length > 0)
    : [];
  return new SecretCipher(key, legacyKeys);
}
