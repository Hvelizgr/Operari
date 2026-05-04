import { computeBackoffDelay, readRetryPolicy } from '../../../runbook/services/retry-policy';

describe('readRetryPolicy', () => {
  it('returns null for a node with no config', () => {
    expect(readRetryPolicy({})).toBeNull();
  });

  it('returns null for a node whose config has no _retry', () => {
    expect(readRetryPolicy({ config: { command: 'ls' } })).toBeNull();
  });

  it('returns null when count is 0 or negative (no-op policy)', () => {
    expect(readRetryPolicy({ config: { _retry: { count: 0 } } })).toBeNull();
    expect(readRetryPolicy({ config: { _retry: { count: -3 } } })).toBeNull();
  });

  it('applies engine defaults when only count is set', () => {
    expect(readRetryPolicy({ config: { _retry: { count: 3 } } })).toEqual({
      count: 3,
      backoff: 'fixed',
      delayMs: 1_000,
      maxDelayMs: 60_000,
    });
  });

  it('preserves explicit fields when supplied', () => {
    expect(
      readRetryPolicy({
        config: {
          _retry: { count: 5, backoff: 'exponential', delayMs: 500, maxDelayMs: 8_000 },
        },
      })
    ).toEqual({ count: 5, backoff: 'exponential', delayMs: 500, maxDelayMs: 8_000 });
  });

  it('caps count at 20 to keep retry loops bounded', () => {
    const policy = readRetryPolicy({ config: { _retry: { count: 999 } } });
    expect(policy?.count).toBe(20);
  });

  it('drops bad shapes silently (non-object _retry)', () => {
    expect(readRetryPolicy({ config: { _retry: 'oops' } })).toBeNull();
    expect(readRetryPolicy({ config: { _retry: 42 } })).toBeNull();
  });

  it('falls back to defaults for negative delayMs / non-positive maxDelayMs', () => {
    const policy = readRetryPolicy({
      config: { _retry: { count: 2, delayMs: -1, maxDelayMs: 0 } },
    });
    expect(policy?.delayMs).toBe(1_000);
    expect(policy?.maxDelayMs).toBe(60_000);
  });

  it("ignores an unknown backoff value and uses 'fixed'", () => {
    const policy = readRetryPolicy({ config: { _retry: { count: 2, backoff: 'random' } } });
    expect(policy?.backoff).toBe('fixed');
  });
});

describe('computeBackoffDelay', () => {
  const fixed = readRetryPolicy({ config: { _retry: { count: 3, delayMs: 750 } } })!;
  const exp = readRetryPolicy({
    config: {
      _retry: { count: 5, backoff: 'exponential', delayMs: 100, maxDelayMs: 1_000 },
    },
  })!;

  it('fixed backoff returns delayMs every attempt', () => {
    expect(computeBackoffDelay(fixed, 0)).toBe(750);
    expect(computeBackoffDelay(fixed, 1)).toBe(750);
    expect(computeBackoffDelay(fixed, 5)).toBe(750);
  });

  it('exponential backoff doubles each attempt', () => {
    expect(computeBackoffDelay(exp, 0)).toBe(100);
    expect(computeBackoffDelay(exp, 1)).toBe(200);
    expect(computeBackoffDelay(exp, 2)).toBe(400);
    expect(computeBackoffDelay(exp, 3)).toBe(800);
  });

  it('exponential backoff caps at maxDelayMs', () => {
    expect(computeBackoffDelay(exp, 4)).toBe(1_000); // 1600 capped
    expect(computeBackoffDelay(exp, 10)).toBe(1_000); // very large capped
  });
});
