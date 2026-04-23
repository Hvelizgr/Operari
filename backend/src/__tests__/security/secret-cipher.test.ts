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
