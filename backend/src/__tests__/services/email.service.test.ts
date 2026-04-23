import { sendEmail } from '../../services/email.service';

/**
 * The service uses the global fetch polyfill in Node 18+. We stub it
 * directly on globalThis so the test covers the serialization path
 * end-to-end (including the `html` pass-through added when we
 * started serving HTML templates).
 */
describe('email.service', () => {
  const originalFetch = globalThis.fetch;
  const originalKey = process.env.RESEND_API_KEY;

  afterEach(() => {
    globalThis.fetch = originalFetch;
    process.env.RESEND_API_KEY = originalKey;
    jest.resetAllMocks();
  });

  it('forwards `html` to Resend when supplied', async () => {
    process.env.RESEND_API_KEY = 'test_key';
    const fetchMock = jest.fn().mockResolvedValue({
      ok: true,
      json: jest.fn().mockResolvedValue({ id: 'resend_123' }),
    });
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    const result = await sendEmail({
      to: 'you@example.com',
      subject: 'Hi',
      text: 'plain body',
      html: '<strong>Hi</strong>',
    });

    expect(result.delivered).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const body = JSON.parse((fetchMock.mock.calls[0]![1] as RequestInit).body as string) as {
      html?: string;
      text: string;
    };
    expect(body.html).toBe('<strong>Hi</strong>');
    expect(body.text).toBe('plain body');
  });

  it('omits the `html` key entirely when not supplied so old endpoints stay untouched', async () => {
    process.env.RESEND_API_KEY = 'test_key';
    const fetchMock = jest.fn().mockResolvedValue({
      ok: true,
      json: jest.fn().mockResolvedValue({ id: 'resend_123' }),
    });
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    await sendEmail({ to: 'you@example.com', subject: 'Hi', text: 'plain body' });

    const body = JSON.parse((fetchMock.mock.calls[0]![1] as RequestInit).body as string) as {
      html?: string;
    };
    expect(body).not.toHaveProperty('html');
  });

  it('logs and returns loggedOnly when no RESEND_API_KEY is set', async () => {
    delete process.env.RESEND_API_KEY;
    const fetchMock = jest.fn();
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    const result = await sendEmail({ to: 'you@example.com', subject: 'Hi', text: 'plain' });

    expect(result.delivered).toBe(true);
    expect(result.loggedOnly).toBe(true);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
