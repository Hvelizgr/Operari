import { CatalogExecutor, SERVICE_NODES } from '../../../runbook/catalog';
import type { ExecutorContext } from '../../../runbook/types/executor.types';

jest.mock('../../../security/ssrf-guard', () => ({
  guardedFetch: (f: typeof fetch, url: string, init: RequestInit) => f(url, init),
}));

const ctx = (): ExecutorContext => ({
  runId: 'r',
  stepId: 's',
  variables: {},
  previousOutputs: {},
  tenantId: 't',
});
const node = (type: string) => SERVICE_NODES.find(n => n.type === type)!;

type Page = { body: unknown; headers?: Record<string, string>; status?: number };
function server(pages: Page[]) {
  const calls: Array<{ url: string; body: unknown }> = [];
  const fetchMock = (async (url: string, init: RequestInit) => {
    calls.push({ url, body: init.body ? JSON.parse(String(init.body)) : undefined });
    const p = pages[Math.min(calls.length - 1, pages.length - 1)];
    return new Response(JSON.stringify(p.body), { status: p.status ?? 200, headers: p.headers });
  }) as unknown as typeof fetch;
  return { fetchMock, calls };
}

const run = (type: string, config: Record<string, unknown>, fetchMock: typeof fetch) =>
  new CatalogExecutor(node(type), fetchMock).execute(
    { credential: 'tok', returnAll: true, ...config },
    ctx()
  );

describe('Return all', () => {
  it('Slack: follows next_cursor in the query at the largest page size', async () => {
    const s = server([
      { body: { ok: true, channels: [{ id: 'C1' }], response_metadata: { next_cursor: 'abc' } } },
      { body: { ok: true, channels: [{ id: 'C2' }], response_metadata: { next_cursor: '' } } },
    ]);
    const res = await run('slack', { operation: 'conversation.list' }, s.fetchMock);
    expect(res.output).toMatchObject({
      data: { items: [{ id: 'C1' }, { id: 'C2' }], pages: 2, truncated: false },
    });
    expect(new URL(s.calls[0].url).searchParams.get('limit')).toBe('200');
    expect(new URL(s.calls[1].url).searchParams.get('cursor')).toBe('abc');
  });

  it('GitHub: follows the Link header', async () => {
    const s = server([
      {
        body: [{ n: 1 }],
        headers: {
          link: '<https://api.github.com/x?page=2>; rel="next", <https://api.github.com/x?page=9>; rel="last"',
        },
      },
      { body: [{ n: 2 }] },
    ]);
    const res = await run('github', { operation: 'repo.list', org: 'acme' }, s.fetchMock);
    expect((res.output as any).data.items).toEqual([{ n: 1 }, { n: 2 }]);
    expect(s.calls[1].url).toBe('https://api.github.com/x?page=2');
    expect(new URL(s.calls[0].url).searchParams.get('per_page')).toBe('100');
  });

  it('GitHub: never follows a next link to another host with the credential', async () => {
    const s = server([
      {
        body: [{ n: 1 }],
        headers: { link: '<https://evil.example.com/steal?page=2>; rel="next"' },
      },
      { body: [{ n: 2 }] },
    ]);
    const res = await run('github', { operation: 'repo.list', org: 'acme' }, s.fetchMock);
    expect((res.output as any).data.items).toEqual([{ n: 1 }]);
    expect(s.calls).toHaveLength(1);
  });

  it('Notion: puts the cursor in the body of POST queries', async () => {
    const s = server([
      { body: { results: [1, 2], next_cursor: 'c2', has_more: true } },
      { body: { results: [3], next_cursor: null, has_more: false } },
    ]);
    const res = await run(
      'notion',
      { operation: 'database.query', databaseId: 'db1' },
      s.fetchMock
    );
    expect((res.output as any).data.count).toBe(3);
    expect(s.calls[0].body).toMatchObject({ page_size: 100 });
    expect(s.calls[1].body).toMatchObject({ start_cursor: 'c2' });
  });

  it('Stripe: uses the last id while has_more', async () => {
    const s = server([
      { body: { data: [{ id: 'ch_1' }, { id: 'ch_2' }], has_more: true } },
      { body: { data: [{ id: 'ch_3' }], has_more: false } },
    ]);
    const res = await run('stripe', { operation: 'charge.list' }, s.fetchMock);
    expect((res.output as any).data.items.map((c: any) => c.id)).toEqual(['ch_1', 'ch_2', 'ch_3']);
    expect(new URL(s.calls[1].url).searchParams.get('starting_after')).toBe('ch_2');
  });

  it('stops at maxItems and says so', async () => {
    const s = server([{ body: { data: [{ id: 'a' }, { id: 'b' }, { id: 'c' }], has_more: true } }]);
    const res = await run('stripe', { operation: 'charge.list', maxItems: 2 }, s.fetchMock);
    expect((res.output as any).data).toMatchObject({ count: 2, truncated: true, pages: 1 });
    expect(s.calls).toHaveLength(1);
  });

  it('fails with the page number and keeps what it had on an error page', async () => {
    const s = server([
      { body: { data: [{ id: 'a' }], has_more: true } },
      { body: { error: { message: 'rate limited' } }, status: 429 },
    ]);
    const res = await run('stripe', { operation: 'charge.list' }, s.fetchMock);
    expect(res.success).toBe(false);
    expect(res.error).toMatch(/HTTP 429 .* on page 2/);
    expect((res.output as any).items).toEqual([{ id: 'a' }]);
  });

  it('is off unless asked and only on list operations', async () => {
    const s = server([{ body: { ok: true, channels: [] } }]);
    const res = await new CatalogExecutor(node('slack'), s.fetchMock).execute(
      { credential: 'tok', operation: 'conversation.list' },
      ctx()
    );
    expect((res.output as any).data).toEqual({ ok: true, channels: [] });
    const props = node('slack').properties.find(p => p.name === 'returnAll')!;
    expect(props.displayOptions?.show.operation).not.toContain('message.post');
  });
});
