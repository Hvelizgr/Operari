// env.config validates JWT_SECRET (min 32 chars) at import time and calls
// process.exit on failure. webhook-dedup imports env.config transitively
// via logger.config, so we install compliant values BEFORE the import
// chain resolves.
process.env.JWT_SECRET = 'test-secret-key-at-least-32-chars-long-123';
process.env.DATABASE_URL = process.env.DATABASE_URL ?? 'postgresql://x:y@localhost:5432/z';

import { Prisma } from '@prisma/client';

import { recordWebhookEvent, verifyWebhookTimestamp } from '../../utils/webhook-dedup';

describe('verifyWebhookTimestamp', () => {
  const NOW_MS = 1_700_000_000_000; // fixed anchor so every assert is deterministic
  const now = () => NOW_MS;
  const nowSec = Math.floor(NOW_MS / 1000);

  it('returns null when no header is supplied (treat absence as not applicable)', () => {
    expect(verifyWebhookTimestamp({ header: undefined, now })).toBeNull();
    expect(verifyWebhookTimestamp({ header: '', now })).toBeNull();
  });

  it('returns null when the header sits inside the default 5-minute window', () => {
    // 1 minute in the past — inside tolerance
    const header = String(nowSec - 60);
    expect(verifyWebhookTimestamp({ header, now })).toBeNull();
  });

  it('rejects drift beyond the tolerance window', () => {
    // 10 minutes in the past — outside default tolerance of 300s
    const header = String(nowSec - 600);
    const reason = verifyWebhookTimestamp({ header, now });
    expect(reason).toMatch(/timestamp_drift/);
  });

  it('respects a custom tolerance window', () => {
    // 2 minutes in the past rejected under 60s tolerance
    const header = String(nowSec - 120);
    expect(verifyWebhookTimestamp({ header, toleranceSeconds: 60, now })).toMatch(
      /timestamp_drift/
    );
  });

  it('rejects unparseable headers explicitly (no silent pass-through)', () => {
    expect(verifyWebhookTimestamp({ header: 'not-a-number', now })).toBe('timestamp_unparseable');
    expect(verifyWebhookTimestamp({ header: '-1', now })).toBe('timestamp_unparseable');
  });

  it('accepts millisecond-encoded timestamps when millis=true', () => {
    // 30s in the past, expressed in ms
    const header = String(NOW_MS - 30_000);
    expect(verifyWebhookTimestamp({ header, millis: true, now })).toBeNull();
  });

  it('rejects future drift beyond tolerance (clock-skewed attacker)', () => {
    const header = String(nowSec + 1000);
    expect(verifyWebhookTimestamp({ header, now })).toMatch(/timestamp_drift/);
  });
});

describe('recordWebhookEvent', () => {
  const buildPrisma = (createImpl: jest.Mock) =>
    ({
      webhookEvent: { create: createImpl },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    }) as any;

  it('returns { duplicate: false } on successful insert', async () => {
    const create = jest.fn().mockResolvedValue({ id: 'we-1' });
    const result = await recordWebhookEvent(buildPrisma(create), {
      source: 'stripe',
      eventId: 'evt_123',
    });
    expect(result.duplicate).toBe(false);
    expect(create).toHaveBeenCalledWith({
      data: { source: 'stripe', eventId: 'evt_123', tenantId: null },
    });
  });

  it('returns { duplicate: true } when Prisma throws P2002 (unique_violation)', async () => {
    const p2002 = new Prisma.PrismaClientKnownRequestError('Unique constraint failed', {
      code: 'P2002',
      clientVersion: '5.22.0',
    });
    const create = jest.fn().mockRejectedValue(p2002);
    const result = await recordWebhookEvent(buildPrisma(create), {
      source: 'stripe',
      eventId: 'evt_123',
    });
    expect(result.duplicate).toBe(true);
  });

  it('rethrows non-P2002 errors (caller must decide to 5xx)', async () => {
    const other = new Prisma.PrismaClientKnownRequestError('Connection terminated', {
      code: 'P2024',
      clientVersion: '5.22.0',
    });
    const create = jest.fn().mockRejectedValue(other);
    await expect(
      recordWebhookEvent(buildPrisma(create), { source: 'stripe', eventId: 'evt_123' })
    ).rejects.toBe(other);
  });

  it('threads tenantId into the row when supplied', async () => {
    const create = jest.fn().mockResolvedValue({ id: 'we-2' });
    await recordWebhookEvent(buildPrisma(create), {
      source: 'github',
      eventId: 'delivery-uuid',
      tenantId: 'tenant-42',
    });
    expect(create).toHaveBeenCalledWith({
      data: { source: 'github', eventId: 'delivery-uuid', tenantId: 'tenant-42' },
    });
  });
});
