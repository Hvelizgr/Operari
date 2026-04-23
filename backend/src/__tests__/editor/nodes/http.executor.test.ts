import { HttpNodeExecutor } from '../../../editor/nodes/http.executor';
import { ErrorCode, HttpError } from '../../../errors/custom-error';
import type { Logger } from '../../../services/logger.service';

const buildLogger = () => {
  const logger = {
    error: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
  };
  return { logger: logger as unknown as Logger, spy: logger };
};

const errCtx = { nodeId: 'n', nodeName: 'HTTP', nodeType: 'HTTP' };

describe('HttpNodeExecutor', () => {
  let mockFetch: jest.Mock;

  beforeEach(() => {
    mockFetch = jest.fn();
    global.fetch = mockFetch as unknown as typeof fetch;
  });

  it('exposes type=HTTP and Api alias', () => {
    const exec = new HttpNodeExecutor(buildLogger());
    expect(exec.type).toBe('HTTP');
    expect(exec.aliases).toEqual(['Api', 'nanorun.httpRequest']);
  });

  it('GETs the resolved URL and returns parsed JSON', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      status: 200,
      statusText: 'OK',
      headers: new Map([['content-type', 'application/json']]) as never,
      json: async () => ({ user: 'alice' }),
      text: async () => '',
    });

    const exec = new HttpNodeExecutor(buildLogger());
    const result = await exec.execute(
      { url: 'https://api.test/users/{{id}}', method: 'GET' },
      { id: 'alice' },
      errCtx
    );

    expect(mockFetch).toHaveBeenCalledWith(
      'https://api.test/users/alice',
      expect.objectContaining({ method: 'GET' })
    );
    expect(result.status).toBe(200);
    expect(result.data).toEqual({ user: 'alice' });
  });

  it('falls back to text() when json() throws', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      status: 200,
      statusText: 'OK',
      headers: new Map() as never,
      json: async () => {
        throw new Error('not json');
      },
      text: async () => 'plaintext',
    });

    const exec = new HttpNodeExecutor(buildLogger());
    const result = await exec.execute({ url: 'https://api.test' }, {}, errCtx);
    expect(result.data).toBe('plaintext');
  });

  it('throws HttpError on non-OK with the original status code', async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      status: 500,
      statusText: 'Internal Server Error',
      headers: new Map() as never,
    });
    const exec = new HttpNodeExecutor(buildLogger());

    try {
      await exec.execute({ url: 'https://api.test', retries: 1 }, {}, errCtx);
      fail('expected throw');
    } catch (err) {
      expect(err).toBeInstanceOf(HttpError);
      // upstreamStatus captures the external service's failure code
      // (the server we called returned 500). The HttpError's inherited
      // statusCode getter is the client-facing HTTP status we'd surface,
      // which for HTTP_REQUEST_FAILED maps to 502 — that's a separate
      // concern from what the upstream server said.
      expect((err as HttpError).upstreamStatus).toBe(500);
    }
  });

  it('maps 408 / 504 to HTTP_TIMEOUT via statusToErrorCode', () => {
    expect(HttpNodeExecutor.statusToErrorCode(408)).toBe(ErrorCode.HTTP_TIMEOUT);
    expect(HttpNodeExecutor.statusToErrorCode(504)).toBe(ErrorCode.HTTP_TIMEOUT);
    expect(HttpNodeExecutor.statusToErrorCode(500)).toBe(ErrorCode.HTTP_REQUEST_FAILED);
    expect(HttpNodeExecutor.statusToErrorCode(404)).toBe(ErrorCode.HTTP_REQUEST_FAILED);
  });

  it('logs and rethrows on transport-level failures', async () => {
    mockFetch.mockRejectedValue(new Error('ECONNREFUSED'));
    const { logger, spy } = buildLogger();
    const exec = new HttpNodeExecutor({ logger });

    await expect(
      exec.execute({ url: 'https://api.test', retries: 1 }, {}, errCtx)
    ).rejects.toBeInstanceOf(HttpError);

    expect(spy.error).toHaveBeenCalled();
  });
});
