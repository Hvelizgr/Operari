import {
  authorizeUrl,
  CONNECT_PROVIDERS,
  exchangeCode,
  OAuthTokenError,
  refreshTokens,
} from '../../integrations/oauth-connect';
import { ConnectedAccountService } from '../../security/connected-account.service';
import { SecretCipher } from '../../security/secret-cipher';

const NOW = 1_800_000_000_000;

beforeAll(() => {
  for (const id of Object.keys(CONNECT_PROVIDERS)) {
    process.env[`OAUTH_${id.toUpperCase()}_CLIENT_ID`] = `${id}-client`;
    process.env[`OAUTH_${id.toUpperCase()}_CLIENT_SECRET`] = `${id}-secret`;
  }
});

const jsonResponse = (status: number, body: unknown) =>
  ({ ok: status < 400, status, json: async () => body }) as unknown as Response;

describe('authorize URLs', () => {
  it('ask for offline access where the provider needs it', () => {
    const google = new URL(authorizeUrl(CONNECT_PROVIDERS.google, 'https://app/cb', 'st'));
    expect(google.searchParams.get('access_type')).toBe('offline');
    expect(google.searchParams.get('prompt')).toBe('consent');
    expect(google.searchParams.get('redirect_uri')).toBe('https://app/cb');
    expect(google.searchParams.get('state')).toBe('st');
    expect(
      new URL(authorizeUrl(CONNECT_PROVIDERS.dropbox, 'x', 's')).searchParams.get(
        'token_access_type'
      )
    ).toBe('offline');
    expect(
      new URL(authorizeUrl(CONNECT_PROVIDERS.microsoft, 'x', 's')).searchParams.get('scope')
    ).toContain('offline_access');
  });

  it('uses comma-separated scopes for Slack and none for Zoom', () => {
    expect(
      new URL(authorizeUrl(CONNECT_PROVIDERS.slack, 'x', 's')).searchParams.get('scope')
    ).toMatch(/^chat:write,/);
    expect(new URL(authorizeUrl(CONNECT_PROVIDERS.zoom, 'x', 's')).searchParams.has('scope')).toBe(
      false
    );
  });
});

describe('token requests', () => {
  it('parses expiry, refresh token and scopes', async () => {
    const calls: Array<{ url: string; init: RequestInit }> = [];
    const tokens = await exchangeCode(
      CONNECT_PROVIDERS.google,
      'the-code',
      'https://app/cb',
      async (url, init) => {
        calls.push({ url, init });
        return jsonResponse(200, {
          access_token: 'at',
          refresh_token: 'rt',
          expires_in: 3599,
          scope: 'a b',
        });
      },
      NOW
    );
    expect(tokens).toMatchObject({ accessToken: 'at', refreshToken: 'rt', scopes: ['a', 'b'] });
    expect(tokens.expiresAt?.getTime()).toBe(NOW + 3599_000);
    const body = new URLSearchParams(String(calls[0].init.body));
    expect(body.get('grant_type')).toBe('authorization_code');
    expect(body.get('client_secret')).toBe('google-secret');
  });

  it('sends Zoom client credentials as basic auth, not in the body', async () => {
    let init: RequestInit | undefined;
    await refreshTokens(CONNECT_PROVIDERS.zoom, 'rt', async (_u, i) => {
      init = i;
      return jsonResponse(200, { access_token: 'at', expires_in: 3600 });
    });
    expect((init?.headers as Record<string, string>).authorization).toBe(
      'Basic ' + Buffer.from('zoom-client:zoom-secret').toString('base64')
    );
    expect(new URLSearchParams(String(init?.body)).has('client_secret')).toBe(false);
  });

  it('treats Slack ok:false as an error and flags revoked grants', async () => {
    await expect(
      exchangeCode(CONNECT_PROVIDERS.slack, 'c', 'r', async () =>
        jsonResponse(200, { ok: false, error: 'invalid_code' })
      )
    ).rejects.toThrow(/invalid_code/);
    const err = await refreshTokens(CONNECT_PROVIDERS.google, 'rt', async () =>
      jsonResponse(400, {
        error: 'invalid_grant',
        error_description: 'Token has been expired or revoked.',
      })
    ).catch(e => e);
    expect(err).toBeInstanceOf(OAuthTokenError);
    expect(err.revoked).toBe(true);
  });
});

describe('ConnectedAccountService auto-refresh', () => {
  const cipher = new SecretCipher('ab'.repeat(32));
  const tenantId = 't1';

  function setup(expiresInMs: number, fetchImpl: (u: string, i: RequestInit) => Promise<Response>) {
    let row: any = {
      id: 'acc-1',
      tenantId,
      userId: 'u1',
      provider: 'google',
      displayName: 'me@example.com',
      accessToken: cipher.encryptForTenant('old-at', tenantId),
      refreshToken: cipher.encryptForTenant('old-rt', tenantId),
      tokenExpiry: new Date(NOW + expiresInMs),
      scopes: [],
      metadata: {},
    };
    const reads: string[] = [];
    const audits: string[] = [];
    const prisma = {
      connectedAccount: {
        findUnique: jest.fn(async () => row),
        update: jest.fn(async ({ data }: any) => (row = { ...row, ...data })),
      },
    };
    const reader = {
      read: async (r: { ciphertext: string; tenantId: string; reason: string }) => {
        reads.push(r.reason);
        return cipher.decryptForTenant(r.ciphertext, r.tenantId);
      },
    };
    const audit = { record: async (e: { type: string }) => audits.push(e.type) };
    const svc = new ConnectedAccountService(prisma as any, cipher, reader as any, audit as any, {
      fetchImpl: fetchImpl as any,
      now: () => NOW,
    });
    const read = () =>
      svc.getAccessToken({
        accountId: 'acc-1',
        tenantId,
        actorId: 'run:r',
        reason: 'runbook-step:s',
      });
    return { svc, read, prisma, reads, audits, row: () => row };
  }

  it('leaves a token with plenty of life alone', async () => {
    const fetchImpl = jest.fn();
    const s = setup(30 * 60_000, fetchImpl);
    expect(await s.read()).toBe('old-at');
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('renews a token about to expire, stores the rotated refresh token and audits it', async () => {
    const s = setup(60_000, async () =>
      jsonResponse(200, { access_token: 'new-at', refresh_token: 'new-rt', expires_in: 3600 })
    );
    expect(await s.read()).toBe('new-at');
    expect(cipher.decryptForTenant(s.row().refreshToken, tenantId)).toBe('new-rt');
    expect(s.row().tokenExpiry.getTime()).toBe(NOW + 3600_000);
    expect(s.reads).toEqual(['oauth-refresh', 'runbook-step:s']);
    expect(s.audits).toEqual(['connectedaccount.refreshed']);
  });

  it('shares one refresh between concurrent reads', async () => {
    let calls = 0;
    const s = setup(0, async () => {
      calls++;
      await new Promise(r => setTimeout(r, 20));
      return jsonResponse(200, { access_token: 'new-at', expires_in: 3600 });
    });
    const results = await Promise.all([s.read(), s.read(), s.read()]);
    expect(results).toEqual(['new-at', 'new-at', 'new-at']);
    expect(calls).toBe(1);
  });

  it('keeps using a still-valid token when the provider is down', async () => {
    const s = setup(60_000, async () => {
      throw new Error('ECONNRESET');
    });
    expect(await s.read()).toBe('old-at');
  });

  it('fails clearly once expired and revoked', async () => {
    const s = setup(-60_000, async () => jsonResponse(400, { error: 'invalid_grant' }));
    await expect(s.read()).rejects.toMatchObject({
      code: 'REFRESH_FAILED',
      message: expect.stringMatching(/reconnect/),
    });
  });

  it('never refreshes providers it does not know', async () => {
    const fetchImpl = jest.fn();
    const s = setup(-60_000, fetchImpl);
    s.row().provider = 'stripe';
    expect(await s.read()).toBe('old-at');
    expect(fetchImpl).not.toHaveBeenCalled();
  });
});
