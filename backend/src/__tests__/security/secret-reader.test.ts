import { randomBytes } from 'crypto';
import { SecretCipher, SecretCipherError } from '../../security/secret-cipher';
import { SecretReader } from '../../security/secret-reader';
import type { AuditService } from '../../audit/audit.service';

const HEX_KEY = randomBytes(32).toString('hex');

function makeAuditMock(): jest.Mocked<Pick<AuditService, 'record'>> {
  return {
    record: jest.fn().mockResolvedValue({ id: 'audit-1', hash: 'h', seq: 1n }),
  };
}

describe('SecretReader', () => {
  it('returns plaintext and emits a successful secret.accessed event', async () => {
    const cipher = new SecretCipher(HEX_KEY);
    const audit = makeAuditMock();
    const reader = new SecretReader(cipher, audit as unknown as AuditService);
    const blob = cipher.encrypt('ghp_token');

    const out = await reader.read({
      ciphertext: blob,
      tenantId: 'tenant-1',
      actorId: 'user-1',
      actorType: 'user',
      resource: 'connected-account:gh-1',
      reason: 'oauth-refresh',
    });

    expect(out).toBe('ghp_token');
    expect(audit.record).toHaveBeenCalledTimes(1);
    const arg = audit.record.mock.calls[0][0];
    expect(arg.type).toBe('secret.accessed');
    expect(arg.tenantId).toBe('tenant-1');
    expect(arg.actorId).toBe('user-1');
    expect(arg.actorType).toBe('user');
    expect(arg.resource).toBe('connected-account:gh-1');
    const payload = arg.payload as Record<string, unknown>;
    expect(payload.success).toBe(true);
    expect(payload.reason).toBe('oauth-refresh');
    expect(typeof payload.keyFingerprint).toBe('string');
    expect(typeof payload.durationMs).toBe('number');
    expect(payload.error).toBeUndefined();
  });

  it('audits a failure event and rethrows when ciphertext is tampered', async () => {
    const cipher = new SecretCipher(HEX_KEY);
    const audit = makeAuditMock();
    const reader = new SecretReader(cipher, audit as unknown as AuditService);
    const blob = cipher.encrypt('hunter2');
    // Flip a byte in the middle segment (ciphertext) to force AEAD failure
    const parts = blob.split(':');
    parts[2] = Buffer.from(
      Buffer.from(parts[2], 'base64').map((b, i) => (i === 0 ? b ^ 0x01 : b))
    ).toString('base64');
    const tampered = parts.join(':');

    await expect(
      reader.read({
        ciphertext: tampered,
        tenantId: 'tenant-1',
        resource: 'connected-account:gh-2',
        reason: 'oauth-refresh',
        actorType: 'system',
      })
    ).rejects.toBeInstanceOf(SecretCipherError);

    expect(audit.record).toHaveBeenCalledTimes(1);
    const payload = audit.record.mock.calls[0][0].payload as Record<string, unknown>;
    expect(payload.success).toBe(false);
    expect(typeof payload.error).toBe('string');
  });

  it('defaults actorType to system when not provided', async () => {
    const cipher = new SecretCipher(HEX_KEY);
    const audit = makeAuditMock();
    const reader = new SecretReader(cipher, audit as unknown as AuditService);
    const blob = cipher.encrypt('x');

    await reader.read({
      ciphertext: blob,
      tenantId: 't',
      resource: 'r',
      reason: 'cron',
    });

    expect(audit.record.mock.calls[0][0].actorType).toBe('system');
  });

  it('does not let an audit failure break a successful read', async () => {
    const cipher = new SecretCipher(HEX_KEY);
    const audit = {
      record: jest.fn().mockRejectedValue(new Error('postgres down')),
    } as unknown as AuditService;
    const reader = new SecretReader(cipher, audit);
    const blob = cipher.encrypt('still-works');

    const out = await reader.read({
      ciphertext: blob,
      tenantId: 't',
      resource: 'r',
      reason: 'oauth-refresh',
    });
    expect(out).toBe('still-works');
  });
});
