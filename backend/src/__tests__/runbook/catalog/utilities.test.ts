import { BUILTIN_CATALOG, CatalogExecutor } from '../../../runbook/catalog';
import type { ExecutorContext } from '../../../runbook/types/executor.types';

const ctx = (previousOutputs: Record<string, unknown> = {}): ExecutorContext => ({
  runId: 'run-1',
  stepId: 'step-1',
  variables: {},
  previousOutputs,
  tenantId: 't-1',
});
const run = (type: string, config: Record<string, unknown>, fetchFn?: typeof fetch) =>
  new CatalogExecutor(BUILTIN_CATALOG.find(n => n.type === type)!, fetchFn).execute(config, ctx());

describe('utility steps', () => {
  it('renames keys on every item', async () => {
    const res = await run('operari.renameKeys', { input: '[{"a":1,"b":2}]', mapping: '{"a":"x"}' });
    expect(res.output).toEqual({ items: [{ x: 1, b: 2 }], count: 1 });
  });

  it('splits a list field into items', async () => {
    const res = await run('operari.splitOut', {
      items: '[{"id":1,"tags":["a","b"]}]',
      field: 'tags',
      as: 'tag',
    });
    expect(res.output).toEqual({
      items: [
        { id: 1, tag: 'a' },
        { id: 1, tag: 'b' },
      ],
      count: 2,
    });
  });

  it('compares two datasets by key', async () => {
    const res = await run('operari.compareDatasets', {
      a: '[{"id":1,"v":1},{"id":2,"v":1},{"id":3,"v":1}]',
      b: '[{"id":2,"v":1},{"id":3,"v":2},{"id":4,"v":1}]',
      key: 'id',
    });
    expect(res.output).toMatchObject({ counts: { onlyA: 1, onlyB: 1, same: 1, changed: 1 } });
    expect((res.output as { changed: Array<{ fields: string[] }> }).changed[0].fields).toEqual([
      'v',
    ]);
  });

  it('summarizes by group', async () => {
    const res = await run('operari.summarize', {
      items: '[{"r":"a","n":2},{"r":"a","n":3},{"r":"b","n":5}]',
      groupBy: 'r',
      op: 'sum',
      field: 'n',
    });
    expect((res.output as { groups: unknown[] }).groups).toEqual([
      { group: 'a', value: 5, count: 2 },
      { group: 'b', value: 5, count: 1 },
    ]);
  });

  it('extracts text, title and absolute links from HTML', async () => {
    const res = await run('operari.html', {
      html: '<html><title>Status</title><script>x()</script><p>All &amp; good</p><a href="/inc/1">Incident</a></html>',
      baseUrl: 'https://status.example.com',
    });
    expect(res.output).toMatchObject({
      title: 'Status',
      links: [{ href: 'https://status.example.com/inc/1', text: 'Incident' }],
    });
    expect((res.output as { text: string }).text).toContain('All & good');
    expect((res.output as { text: string }).text).not.toContain('x()');
  });

  it('round-trips XML', async () => {
    const parsed = await run('operari.xml', { action: 'parse', value: '<a id="1"><b>hi</b></a>' });
    expect(parsed.output).toEqual({ value: { a: { b: 'hi', '@id': '1' } } });
    const built = await run('operari.xml', { action: 'build', value: '{"a":{"b":"hi"}}' });
    expect(String((built.output as { value: string }).value)).toContain('<b>hi</b>');
  });

  it('reads an RSS feed', async () => {
    const feed =
      '<rss><channel><title>Blog</title><item><title>One</title><link>https://x/1</link><description>&lt;p&gt;Hi&lt;/p&gt;</description></item></channel></rss>';
    const fetchFn = (async () => new Response(feed, { status: 200 })) as unknown as typeof fetch;
    const res = await run('operari.rss', { url: 'https://x/feed' }, fetchFn);
    expect(res.output).toMatchObject({
      title: 'Blog',
      count: 1,
      entries: [{ title: 'One', link: 'https://x/1', summary: 'Hi' }],
    });
  });

  it('builds a calendar invite', async () => {
    const res = await run('operari.ical', {
      title: 'Postmortem, review',
      start: '2026-11-02T15:00:00Z',
      end: '2026-11-02T16:00:00Z',
      attendees: 'a@x.com,b@x.com',
    });
    const ics = (res.output as { ics: string }).ics;
    expect(ics).toContain('DTSTART:20261102T150000Z');
    expect(ics).toContain('SUMMARY:Postmortem\\, review');
    expect(ics.match(/ATTENDEE/g)).toHaveLength(2);
  });

  it('builds a chart URL and rejects non-numeric values', async () => {
    const good = await run('operari.chart', { labels: 'a,b', data: '1,2' });
    expect((good.output as { url: string }).url).toMatch(/^https:\/\/quickchart\.io\/chart\?/);
    const bad = await run('operari.chart', { labels: 'a', data: 'x' });
    expect(bad.success).toBe(false);
  });
});
