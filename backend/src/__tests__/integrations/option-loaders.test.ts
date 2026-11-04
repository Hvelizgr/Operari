import {
  loadOptions,
  optionLoader,
  OptionLoaderError,
  validateParams,
} from '../../integrations/option-loaders';
import { BUILTIN_CATALOG as CATALOG_NODES } from '../../runbook/catalog';

const json = (body: unknown, status = 200) =>
  ({ ok: status < 400, status, json: async () => body }) as unknown as Response;

describe('option loaders', () => {
  it('pages Slack channels with the cursor and sends the token as bearer', async () => {
    const urls: string[] = [];
    let auth = '';
    const fetch = async (url: string, init?: RequestInit) => {
      urls.push(url);
      auth = (init?.headers as Record<string, string>).authorization;
      return url.includes('cursor=')
        ? json({
            ok: true,
            channels: [{ id: 'C2', name: 'alerts' }],
            response_metadata: { next_cursor: '' },
          })
        : json({
            ok: true,
            channels: [{ id: 'C1', name: 'ops' }],
            response_metadata: { next_cursor: 'n1' },
          });
    };
    const out = await loadOptions(optionLoader('slack.channels')!, 'xoxb-1', {}, fetch);
    expect(out).toEqual([
      { name: '#alerts', value: 'C2' },
      { name: '#ops', value: 'C1' },
    ]);
    expect(urls[0]).toMatch(/^https:\/\/slack\.com\/api\/conversations\.list\?/);
    expect(urls[1]).toContain('cursor=n1');
    expect(auth).toBe('Bearer xoxb-1');
  });

  it('turns Slack ok:false and auth errors into readable errors', async () => {
    await expect(
      loadOptions(optionLoader('slack.users')!, 'x', {}, async () =>
        json({ ok: false, error: 'invalid_auth' })
      )
    ).rejects.toThrow(/Slack: invalid_auth/);
    const err = await loadOptions(optionLoader('github.repos')!, 'x', {}, async () =>
      json({}, 401)
    ).catch(e => e);
    expect(err).toBeInstanceOf(OptionLoaderError);
    expect(err.status).toBe(400);
  });

  it('fills the GitHub owner along with the repo', async () => {
    const out = await loadOptions(optionLoader('github.repos')!, 't', {}, async () =>
      json([{ full_name: 'acme/api', name: 'api', owner: { login: 'acme' } }])
    );
    expect(out).toEqual([{ name: 'acme/api', value: 'api', also: { owner: 'acme' } }]);
  });

  it('validates parameters before any call and builds the Jira URL from the site only', async () => {
    const jira = optionLoader('jira.projects')!;
    expect(() => validateParams(jira, { site: 'evil.com/x', email: 'a@b.co' })).toThrow(/site/);
    expect(() => validateParams(jira, { site: 'acme' })).toThrow(/email/);
    const params = validateParams(jira, {
      site: 'acme.atlassian.net',
      email: 'me@acme.com',
      extra: 'x',
    });
    expect(params).toEqual({ site: 'acme.atlassian.net', email: 'me@acme.com' });
    let url = '';
    let auth = '';
    await loadOptions(jira, 'tok', params, async (u, init) => {
      url = u;
      auth = (init?.headers as Record<string, string>).authorization;
      return json({ values: [{ key: 'OPS', name: 'Operations' }] });
    });
    expect(url).toBe('https://acme.atlassian.net/rest/api/3/project/search?maxResults=100');
    expect(auth).toBe('Basic ' + Buffer.from('me@acme.com:tok').toString('base64'));
    expect(() =>
      validateParams(optionLoader('microsoft.channels')!, { teamId: '../me' })
    ).toThrow();
  });

  it('every catalog field with a loader points at a loader of its own provider', () => {
    const wired = CATALOG_NODES.flatMap(n =>
      (n.properties ?? [])
        .filter(p => p.typeOptions?.loadOptions)
        .map(p => `${n.type}.${p.name}=${p.typeOptions!.loadOptions!.loader}`)
    );
    expect(wired).toEqual(
      expect.arrayContaining([
        'slack.channel=slack.channels',
        'github.repo=github.repos',
        'jira.projectKey=jira.projects',
        'microsoftTeams.channelId=microsoft.channels',
      ])
    );
  });
});
