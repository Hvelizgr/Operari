import { createHash } from 'crypto';
import { checkBreachedPassword } from '../../auth/password-breach';

/**
 * HIBP k-anonymity contract:
 *   - SHA-1 the password, send only the first 5 hex chars.
 *   - Parse `suffix:count` lines, match our suffix exactly.
 *   - Fail-open on any transport/server error.
 *
 * The tests pin all three axes so a future refactor can't silently
 * break the privacy-preserving prefix-only protocol or the fail-open
 * behaviour (which is what stops a HIBP outage from blocking signups).
 */

function sha1Upper(password: string): string {
  return createHash('sha1').update(password, 'utf8').digest('hex').toUpperCase();
}

describe('checkBreachedPassword', () => {
  beforeEach(() => {
    delete process.env.NANORUN_PASSWORD_BREACH_CHECK;
    delete process.env.NANORUN_PASSWORD_BREACH_THRESHOLD;
  });

  it('flags a password whose suffix is in the HIBP response', async () => {
    const password = 'hunter2';
    const sha = sha1Upper(password);
    const suffix = sha.slice(5);
    const body = [`${suffix}:42`, 'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAB:1'].join('\r\n');
    const fetchImpl = jest.fn(async () => ({
      ok: true,
      status: 200,
      text: async () => body,
    })) as unknown as typeof fetch;

    const result = await checkBreachedPassword(password, { fetchImpl });
    expect(result.breached).toBe(true);
    expect(result.occurrences).toBe(42);
  });

  it('sends only the 5-char prefix — never the full password or hash', async () => {
    const fetchImpl = jest.fn(async () => ({
      ok: true,
      status: 200,
      text: async () => '',
    })) as unknown as typeof fetch;
    const mock = fetchImpl as unknown as jest.Mock;

    const password = 'supersecret-value';
    const expectedPrefix = sha1Upper(password).slice(0, 5);
    await checkBreachedPassword(password, { fetchImpl });

    const url = mock.mock.calls[0][0] as string;
    expect(url.endsWith(`/range/${expectedPrefix}`)).toBe(true);
    expect(url).not.toContain(password);
    expect(url).not.toContain(sha1Upper(password));
  });

  it('does not flag a password whose suffix is not in the response', async () => {
    const fetchImpl = jest.fn(async () => ({
      ok: true,
      status: 200,
      text: async () => 'ZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZ:99',
    })) as unknown as typeof fetch;
    const result = await checkBreachedPassword('unique-password-nobody-has', { fetchImpl });
    expect(result.breached).toBe(false);
    expect(result.occurrences).toBe(0);
  });

  it('fails open when HIBP returns 5xx', async () => {
    const fetchImpl = jest.fn(async () => ({
      ok: false,
      status: 503,
      text: async () => '',
    })) as unknown as typeof fetch;
    const result = await checkBreachedPassword('anything', { fetchImpl });
    expect(result.breached).toBe(false);
  });

  it('fails open when the fetch itself throws', async () => {
    const fetchImpl = jest.fn(async () => {
      throw new Error('network down');
    }) as unknown as typeof fetch;
    const result = await checkBreachedPassword('anything', { fetchImpl });
    expect(result.breached).toBe(false);
  });

  it('respects NANORUN_PASSWORD_BREACH_CHECK=false and skips the call entirely', async () => {
    process.env.NANORUN_PASSWORD_BREACH_CHECK = 'false';
    const fetchImpl = jest.fn() as unknown as typeof fetch;
    const mock = fetchImpl as unknown as jest.Mock;
    const result = await checkBreachedPassword('anything', { fetchImpl });
    expect(result.breached).toBe(false);
    expect(mock).not.toHaveBeenCalled();
  });

  it('respects NANORUN_PASSWORD_BREACH_THRESHOLD — a rare breach passes', async () => {
    process.env.NANORUN_PASSWORD_BREACH_THRESHOLD = '100';
    const password = 'medium-rare';
    const suffix = sha1Upper(password).slice(5);
    const fetchImpl = jest.fn(async () => ({
      ok: true,
      status: 200,
      text: async () => `${suffix}:2`,
    })) as unknown as typeof fetch;
    const result = await checkBreachedPassword(password, { fetchImpl });
    expect(result.breached).toBe(false);
    expect(result.occurrences).toBe(2);
  });

  it('empty password returns not-breached without hitting HIBP', async () => {
    const fetchImpl = jest.fn() as unknown as typeof fetch;
    const mock = fetchImpl as unknown as jest.Mock;
    const result = await checkBreachedPassword('', { fetchImpl });
    expect(result.breached).toBe(false);
    expect(mock).not.toHaveBeenCalled();
  });
});
