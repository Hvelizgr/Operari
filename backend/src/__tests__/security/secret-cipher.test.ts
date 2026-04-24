import { randomBytes } from 'crypto';

import { SecretCipher, SecretCipherError, secretCipherFromEnv } from '../../security/secret-cipher';

const HEX_KEY = randomBytes(32).toString('hex');
const OTHER_HEX_KEY = randomBytes(32).toString('hex');

describe('SecretCipher', () => {
  it('round-trips a string with the same key', () => {
    const cipher = new SecretCipher(HEX_KEY);
    const blob = cipher.encrypt('ghp_supersecrettoken');
    expect(SecretCipher.isCiphertext(blob)).toBe(true);
    expect(cipher.decrypt(blob)).toBe('ghp_supersecrettoken');
  });

  it('produces a different ciphertext each time (random nonce)', () => {
    const cipher = new SecretCipher(HEX_KEY);
    const a = cipher.encrypt('hello');
    const b = cipher.encrypt('hello');
    expect(a).not.toBe(b);
    expect(cipher.decrypt(a)).toBe('hello');
    expect(cipher.decrypt(b)).toBe('hello');
  });

  it('rejects a ciphertext encrypted with a different key', () => {
    const a = new SecretCipher(HEX_KEY);
    const b = new SecretCipher(OTHER_HEX_KEY);
    const blob = a.encrypt('payload');
    expect(() => b.decrypt(blob)).toThrow(SecretCipherError);
  });

  it('rejects tampered ciphertext', () => {
    const cipher = new SecretCipher(HEX_KEY);
    const blob = cipher.encrypt('payload');
    // Flip a byte in the ciphertext segment
    const parts = blob.split(':');
    const ct = Buffer.from(parts[2], 'base64');
    ct[0] ^= 0xff;
    parts[2] = ct.toString('base64');
    const tampered = parts.join(':');
    expect(() => cipher.decrypt(tampered)).toThrow(SecretCipherError);
  });

  it('binds AAD to the ciphertext', () => {
    const cipher = new SecretCipher(HEX_KEY);
    const blob = cipher.encrypt('payload', 'user-42');
    expect(cipher.decrypt(blob, 'user-42')).toBe('payload');
    expect(() => cipher.decrypt(blob, 'user-99')).toThrow(SecretCipherError);
    expect(() => cipher.decrypt(blob)).toThrow(SecretCipherError);
  });

  it('accepts a 32-byte base64 key', () => {
    const b64Key = randomBytes(32).toString('base64');
    const cipher = new SecretCipher(b64Key);
    const blob = cipher.encrypt('hi');
    expect(cipher.decrypt(blob)).toBe('hi');
  });

  it('accepts a raw 32-byte Buffer key', () => {
    const cipher = new SecretCipher(randomBytes(32));
    const blob = cipher.encrypt('hi');
    expect(cipher.decrypt(blob)).toBe('hi');
  });

  it('rejects keys of the wrong length', () => {
    expect(() => new SecretCipher(randomBytes(16))).toThrow(SecretCipherError);
    expect(() => new SecretCipher('too-short')).toThrow(SecretCipherError);
    expect(() => new SecretCipher('')).toThrow(SecretCipherError);
  });

  it('rejects malformed ciphertext', () => {
    const cipher = new SecretCipher(HEX_KEY);
    expect(() => cipher.decrypt('not-a-ciphertext')).toThrow(SecretCipherError);
    expect(() => cipher.decrypt('v1:a:b')).toThrow(SecretCipherError);
    expect(() => cipher.decrypt('v2:aa:bb:cc')).toThrow(SecretCipherError);
  });

  it('isCiphertext only matches our format', () => {
    expect(SecretCipher.isCiphertext('v1:abc:def:ghi')).toBe(true);
    expect(SecretCipher.isCiphertext('plaintext')).toBe(false);
    expect(SecretCipher.isCiphertext('')).toBe(false);
  });

  it('keyFingerprint is stable and deterministic', () => {
    const a = new SecretCipher(HEX_KEY);
    const b = new SecretCipher(HEX_KEY);
    expect(a.keyFingerprint()).toBe(b.keyFingerprint());
    expect(a.keyFingerprint()).not.toBe(new SecretCipher(OTHER_HEX_KEY).keyFingerprint());
    expect(a.keyFingerprint()).toMatch(/^[0-9a-f]{12}$/);
  });

  it('safeEquals returns true only for identical strings', () => {
    expect(SecretCipher.safeEquals('abc', 'abc')).toBe(true);
    expect(SecretCipher.safeEquals('abc', 'abcd')).toBe(false);
    expect(SecretCipher.safeEquals('abc', 'abd')).toBe(false);
  });
});

describe('secretCipherFromEnv', () => {
  it('builds a cipher from NANORUN_SECRET_KEY', () => {
    const cipher = secretCipherFromEnv({ NANORUN_SECRET_KEY: HEX_KEY });
    expect(cipher.encrypt('x')).toContain('v1:');
  });

  it('throws when the env var is missing', () => {
    expect(() => secretCipherFromEnv({})).toThrow(SecretCipherError);
  });
});

describe('SecretCipher v2 (per-tenant derived keys)', () => {
  it('encryptForTenant emits a v2-prefixed payload', () => {
    const cipher = new SecretCipher(HEX_KEY);
    const blob = cipher.encryptForTenant('payload', 'tenant-a');
    expect(blob.startsWith('v2:')).toBe(true);
    expect(SecretCipher.isCiphertext(blob)).toBe(true);
    expect(SecretCipher.versionOf(blob)).toBe('v2');
  });

  it('decryptForTenant round-trips a v2 payload with the same tenantId', () => {
    const cipher = new SecretCipher(HEX_KEY);
    const blob = cipher.encryptForTenant('ghp_supersecret', 'tenant-a');
    expect(cipher.decryptForTenant(blob, 'tenant-a')).toBe('ghp_supersecret');
  });

  it('rejects cross-tenant decryption even with the same master key', () => {
    // This is the whole point of v2: a leaked ciphertext from tenant A
    // cannot be read by tenant B.
    const cipher = new SecretCipher(HEX_KEY);
    const tenantAPayload = cipher.encryptForTenant('secret', 'tenant-a');
    expect(() => cipher.decryptForTenant(tenantAPayload, 'tenant-b')).toThrow(SecretCipherError);
  });

  it('produces different ciphertexts for the same plaintext in different tenants', () => {
    const cipher = new SecretCipher(HEX_KEY);
    const a = cipher.encryptForTenant('same-secret', 'tenant-a');
    const b = cipher.encryptForTenant('same-secret', 'tenant-b');
    expect(a).not.toBe(b);
    // Both decrypt under their own tenantId.
    expect(cipher.decryptForTenant(a, 'tenant-a')).toBe('same-secret');
    expect(cipher.decryptForTenant(b, 'tenant-b')).toBe('same-secret');
  });

  it('tenant derivation is deterministic under a stable master key', () => {
    const cipherA = new SecretCipher(HEX_KEY);
    const cipherB = new SecretCipher(HEX_KEY);
    const blob = cipherA.encryptForTenant('same-secret', 'tenant-a');
    // Different cipher instance, same master key → same derived key
    // → can decrypt.
    expect(cipherB.decryptForTenant(blob, 'tenant-a')).toBe('same-secret');
  });

  it('decryptForTenant also accepts v1 (legacy master-key) payloads transparently', () => {
    const cipher = new SecretCipher(HEX_KEY);
    const legacy = cipher.encrypt('old-blob', 'aad');
    expect(SecretCipher.versionOf(legacy)).toBe('v1');
    // Passing tenantId is harmless for v1 — the method ignores it.
    expect(cipher.decryptForTenant(legacy, 'any-tenant', 'aad')).toBe('old-blob');
  });

  it('decrypt (v1-only) refuses v2 payloads with a clear error', () => {
    const cipher = new SecretCipher(HEX_KEY);
    const v2 = cipher.encryptForTenant('x', 'tenant-a');
    expect(() => cipher.decrypt(v2)).toThrow(/decryptForTenant/);
  });

  it('encryptForTenant refuses an empty tenantId', () => {
    const cipher = new SecretCipher(HEX_KEY);
    expect(() => cipher.encryptForTenant('x', '')).toThrow(SecretCipherError);
  });

  it('AAD binding still applies in v2', () => {
    const cipher = new SecretCipher(HEX_KEY);
    const blob = cipher.encryptForTenant('payload', 'tenant-a', 'aad-xyz');
    expect(cipher.decryptForTenant(blob, 'tenant-a', 'aad-xyz')).toBe('payload');
    expect(() => cipher.decryptForTenant(blob, 'tenant-a', 'wrong-aad')).toThrow(SecretCipherError);
  });

  it('versionOf returns null for non-ciphertext strings', () => {
    expect(SecretCipher.versionOf('plaintext')).toBeNull();
    expect(SecretCipher.versionOf('v3:foo:bar:baz')).toBeNull();
    expect(SecretCipher.versionOf('')).toBeNull();
  });
});

describe('SecretCipher dual-key (rotation window)', () => {
  const PRIMARY = randomBytes(32).toString('hex');
  const LEGACY = randomBytes(32).toString('hex');
  const OLDER_LEGACY = randomBytes(32).toString('hex');

  it('hasLegacyKeys reflects constructor input', () => {
    expect(new SecretCipher(PRIMARY).hasLegacyKeys()).toBe(false);
    expect(new SecretCipher(PRIMARY, []).hasLegacyKeys()).toBe(false);
    expect(new SecretCipher(PRIMARY, [LEGACY]).hasLegacyKeys()).toBe(true);
  });

  it('v1 decrypt falls back to legacy key when primary fails', () => {
    const oldCipher = new SecretCipher(LEGACY);
    const blob = oldCipher.encrypt('legacy-payload');
    const newCipher = new SecretCipher(PRIMARY, [LEGACY]);
    expect(newCipher.decrypt(blob)).toBe('legacy-payload');
  });

  it('v2 decryptForTenant falls back to legacy master for tenant-derived keys', () => {
    const oldCipher = new SecretCipher(LEGACY);
    const blob = oldCipher.encryptForTenant('legacy-secret', 'tenant-a');
    const newCipher = new SecretCipher(PRIMARY, [LEGACY]);
    expect(newCipher.decryptForTenant(blob, 'tenant-a')).toBe('legacy-secret');
  });

  it('tries multiple legacy keys in order', () => {
    const oldest = new SecretCipher(OLDER_LEGACY);
    const blob = oldest.encryptForTenant('oldest', 'tenant-a');
    const newCipher = new SecretCipher(PRIMARY, [LEGACY, OLDER_LEGACY]);
    expect(newCipher.decryptForTenant(blob, 'tenant-a')).toBe('oldest');
  });

  it('throws when neither primary nor any legacy key decrypts', () => {
    const unrelated = new SecretCipher(randomBytes(32).toString('hex'));
    const blob = unrelated.encryptForTenant('x', 'tenant-a');
    const newCipher = new SecretCipher(PRIMARY, [LEGACY]);
    expect(() => newCipher.decryptForTenant(blob, 'tenant-a')).toThrow(SecretCipherError);
  });

  it('isCipheredUnderPrimary returns true for rows written under the current master', () => {
    const newCipher = new SecretCipher(PRIMARY, [LEGACY]);
    const blob = newCipher.encryptForTenant('fresh', 'tenant-a');
    expect(newCipher.isCipheredUnderPrimary(blob, 'tenant-a')).toBe(true);
  });

  it('isCipheredUnderPrimary returns false for rows written under a legacy master', () => {
    const oldCipher = new SecretCipher(LEGACY);
    const legacyBlob = oldCipher.encryptForTenant('old', 'tenant-a');
    const newCipher = new SecretCipher(PRIMARY, [LEGACY]);
    expect(newCipher.isCipheredUnderPrimary(legacyBlob, 'tenant-a')).toBe(false);
  });

  it('isCipheredUnderPrimary handles v1 ciphertexts', () => {
    const newCipher = new SecretCipher(PRIMARY, [LEGACY]);
    const blob = newCipher.encrypt('fresh-v1');
    expect(newCipher.isCipheredUnderPrimary(blob)).toBe(true);

    const oldCipher = new SecretCipher(LEGACY);
    const legacyBlob = oldCipher.encrypt('old-v1');
    expect(newCipher.isCipheredUnderPrimary(legacyBlob)).toBe(false);
  });

  it('isCipheredUnderPrimary returns false for malformed ciphertexts instead of throwing', () => {
    const newCipher = new SecretCipher(PRIMARY);
    expect(newCipher.isCipheredUnderPrimary('garbage')).toBe(false);
    expect(newCipher.isCipheredUnderPrimary('v2:a:b')).toBe(false);
  });

  it('isCipheredUnderPrimary returns false when v2 is passed without a tenantId', () => {
    const newCipher = new SecretCipher(PRIMARY);
    const blob = newCipher.encryptForTenant('x', 'tenant-a');
    expect(newCipher.isCipheredUnderPrimary(blob)).toBe(false);
  });

  it('isCipheredUnderPrimary honors AAD binding', () => {
    const newCipher = new SecretCipher(PRIMARY);
    const blob = newCipher.encryptForTenant('x', 'tenant-a', 'aad');
    expect(newCipher.isCipheredUnderPrimary(blob, 'tenant-a', 'aad')).toBe(true);
    expect(newCipher.isCipheredUnderPrimary(blob, 'tenant-a', 'wrong')).toBe(false);
  });

  it('secretCipherFromEnv wires legacy keys from NANORUN_SECRET_KEY_LEGACY', () => {
    const cipher = secretCipherFromEnv({
      NANORUN_SECRET_KEY: PRIMARY,
      NANORUN_SECRET_KEY_LEGACY: LEGACY,
    });
    expect(cipher.hasLegacyKeys()).toBe(true);
    const oldCipher = new SecretCipher(LEGACY);
    const blob = oldCipher.encryptForTenant('x', 'tenant-a');
    expect(cipher.decryptForTenant(blob, 'tenant-a')).toBe('x');
  });

  it('secretCipherFromEnv parses comma-separated legacy list', () => {
    const cipher = secretCipherFromEnv({
      NANORUN_SECRET_KEY: PRIMARY,
      NANORUN_SECRET_KEY_LEGACY: `${LEGACY} , ${OLDER_LEGACY}`,
    });
    const oldest = new SecretCipher(OLDER_LEGACY);
    const blob = oldest.encryptForTenant('oldest', 'tenant-a');
    expect(cipher.decryptForTenant(blob, 'tenant-a')).toBe('oldest');
  });

  it('secretCipherFromEnv treats empty NANORUN_SECRET_KEY_LEGACY as no legacy keys', () => {
    const cipher = secretCipherFromEnv({
      NANORUN_SECRET_KEY: PRIMARY,
      NANORUN_SECRET_KEY_LEGACY: '',
    });
    expect(cipher.hasLegacyKeys()).toBe(false);
  });
});
