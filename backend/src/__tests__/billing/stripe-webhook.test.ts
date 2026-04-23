import { createHmac } from 'crypto';
import { verifyStripeWebhook, StripeSignatureError } from '../../billing/stripe-webhook';

/**
 * Stripe's webhook signing is a custom scheme (not plain HMAC of the
 * body) so the verifier has to get three things right: the
 * `t.<body>` payload format, constant-time comparison, and the
 * timestamp tolerance window. We pin all three.
 */

const SECRET = 'whsec_test_key';

function signPayload(body: string, timestamp: number, secret = SECRET): string {
  const mac = createHmac('sha256', secret).update(`${timestamp}.${body}`).digest('hex');
  return `t=${timestamp},v1=${mac}`;
}

describe('verifyStripeWebhook', () => {
  const NOW_SECONDS = 1_700_000_000;
  const now = () => NOW_SECONDS * 1000;

  it('accepts a freshly-signed payload', () => {
    const body = '{"type":"test.ping"}';
    expect(() =>
      verifyStripeWebhook({
        secret: SECRET,
        header: signPayload(body, NOW_SECONDS),
        rawBody: body,
        now,
      })
    ).not.toThrow();
  });

  it('rejects a payload signed with a different secret', () => {
    const body = '{"type":"test.ping"}';
    const header = signPayload(body, NOW_SECONDS, 'whsec_wrong');
    expect(() => verifyStripeWebhook({ secret: SECRET, header, rawBody: body, now })).toThrow(
      StripeSignatureError
    );
  });

  it('rejects a payload where the body was tampered after signing', () => {
    const body = '{"type":"test.ping"}';
    const header = signPayload(body, NOW_SECONDS);
    expect(() =>
      verifyStripeWebhook({
        secret: SECRET,
        header,
        rawBody: '{"type":"tampered"}',
        now,
      })
    ).toThrow(/mismatch/);
  });

  it('rejects a replay outside the tolerance window', () => {
    const body = '{"type":"test.ping"}';
    // 10 minutes old; default tolerance is 5 minutes
    const stale = NOW_SECONDS - 10 * 60;
    const header = signPayload(body, stale);
    expect(() => verifyStripeWebhook({ secret: SECRET, header, rawBody: body, now })).toThrow(
      /tolerance/
    );
  });

  it('rejects a malformed header', () => {
    expect(() =>
      verifyStripeWebhook({
        secret: SECRET,
        header: 'whatever',
        rawBody: '{}',
        now,
      })
    ).toThrow(/missing/);
  });

  it('accepts a header that includes multiple v1 signatures (key rotation)', () => {
    const body = '{"type":"test.ping"}';
    const validMac = createHmac('sha256', SECRET).update(`${NOW_SECONDS}.${body}`).digest('hex');
    const header = `t=${NOW_SECONDS},v1=deadbeef,v1=${validMac}`;
    expect(() => verifyStripeWebhook({ secret: SECRET, header, rawBody: body, now })).not.toThrow();
  });
});
