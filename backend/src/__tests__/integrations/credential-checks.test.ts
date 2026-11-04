import { canCheck, checkCredential } from '../../integrations/credential-checks';

const json = (body: unknown, status = 200) =>
  ({ ok: status < 400, status, json: async () => body }) as unknown as Response;

describe('checkCredential', () => {
  it('reports who a GitHub token belongs to and sends it as bearer', async () => {
    let seen: { url: string; auth: string } | null = null;
    const res = await checkCredential('github', 'ghp_1', {}, async (url, init) => {
      seen = { url, auth: (init?.headers as Record<string, string>).authorization };
      return json({ login: 'octocat' });
    });
    expect(res).toEqual({ ok: true, identity: 'octocat' });
    expect(seen).toEqual({ url: 'https://api.github.com/user', auth: 'Bearer ghp_1' });
  });

  it('treats a Slack 200 with ok:false as a rejection', async () => {
    const res = await checkCredential('slack', 'x', {}, async () =>
      json({ ok: false, error: 'invalid_auth' })
    );
    expect(res).toEqual({ ok: false, error: 'Rejected by the provider: invalid_auth' });
  });

  it('explains 401s and network failures', async () => {
    expect(
      await checkCredential('google', 'x', {}, async () =>
        json({ error: { message: 'Invalid Credentials' } }, 401)
      )
    ).toEqual({ ok: false, error: 'Rejected by the provider: Invalid Credentials' });
    expect(
      (
        await checkCredential('notion', 'x', {}, async () => {
          throw new Error('ECONNRESET');
        })
      ).error
    ).toMatch(/Could not reach the provider: ECONNRESET/);
  });

  it('only tests Salesforce against a salesforce.com instance over https', async () => {
    const urls: string[] = [];
    const f = async (url: string) => {
      urls.push(url);
      return json({ preferred_username: 'me@acme.com' });
    };
    expect(
      await checkCredential('salesforce', 'x', { instanceUrl: 'https://acme.my.salesforce.com' }, f)
    ).toEqual({
      ok: true,
      identity: 'me@acme.com',
    });
    expect(
      (await checkCredential('salesforce', 'x', { instanceUrl: 'https://evil.example.com' }, f)).ok
    ).toBe(false);
    expect((await checkCredential('salesforce', 'x', {}, f)).ok).toBe(false);
    expect(urls).toEqual(['https://acme.my.salesforce.com/services/oauth2/userinfo']);
  });

  it('builds the OpenAI-compatible URL from the account base URL', async () => {
    let url = '';
    await checkCredential(
      'ai.openai-compatible',
      'k',
      { baseUrl: 'https://api.groq.com/openai/v1/' },
      async u => {
        url = u;
        return json({ data: [] });
      }
    );
    expect(url).toBe('https://api.groq.com/openai/v1/models');
  });

  it('knows which providers it can test', () => {
    expect(canCheck('github')).toBe(true);
    expect(canCheck('pagerduty')).toBe(false);
    expect(canCheck('__proto__')).toBe(false);
  });
});
