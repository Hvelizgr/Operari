import pino from 'pino';

/**
 * Verifies the redaction paths declared in logger.config.ts. The
 * logger singleton is pre-constructed at import time with pino-pretty
 * in dev, so re-importing here would capture the pretty transport
 * output (hard to assert on). Instead we rebuild the same pino
 * instance against an in-memory stream and check the JSON line.
 *
 * Keep this list in sync with REDACT_PATHS in logger.config.ts.
 */
const REDACT_PATHS = [
  'req.headers.authorization',
  'req.headers.cookie',
  'req.headers["set-cookie"]',
  'req.headers["x-api-key"]',
  'req.headers["x-webhook-signature"]',
  'req.headers["x-hub-signature-256"]',
  'req.headers["x-stripe-signature"]',
  'headers.authorization',
  'headers.cookie',
  '*.password',
  '*.passwordHash',
  '*.newPassword',
  '*.currentPassword',
  '*.token',
  '*.secret',
  '*.apiKey',
  '*.api_key',
  '*.totpCode',
  '*.signature',
];

function makeLogger(sink: { lines: string[] }) {
  return pino(
    {
      redact: { paths: REDACT_PATHS, censor: '[Redacted]', remove: false },
    },
    {
      write(chunk: string) {
        sink.lines.push(chunk);
      },
    }
  );
}

describe('logger redaction', () => {
  it('masks authorization + cookie headers on a request log', () => {
    const sink = { lines: [] as string[] };
    const log = makeLogger(sink);
    log.info(
      {
        req: {
          method: 'POST',
          url: '/auth/login',
          headers: {
            authorization: 'Bearer leaky-token',
            cookie: 'session=abc',
            'x-api-key': 'live_xxx',
            'user-agent': 'curl/7',
          },
        },
      },
      'request'
    );
    const line = sink.lines[0]!;
    expect(line).not.toContain('leaky-token');
    expect(line).not.toContain('session=abc');
    expect(line).not.toContain('live_xxx');
    expect(line).toContain('[Redacted]');
    // Non-sensitive headers pass through.
    expect(line).toContain('curl/7');
  });

  it('masks password/token/secret regardless of nesting', () => {
    const sink = { lines: [] as string[] };
    const log = makeLogger(sink);
    log.info(
      {
        user: { email: 'a@b.c', password: 'sekret' },
        body: { token: 'tok_123', totpCode: '654321' },
      },
      'signup'
    );
    const line = sink.lines[0]!;
    expect(line).not.toContain('sekret');
    expect(line).not.toContain('tok_123');
    expect(line).not.toContain('654321');
    // The key itself survives so queries like `body.token` still
    // match — the value is just censored.
    expect(line).toContain('password');
    expect(line).toContain('token');
  });
});
