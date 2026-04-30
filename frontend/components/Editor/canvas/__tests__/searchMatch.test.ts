import type { RfNode } from '@/lib/canvas/adapter';

import { ngramScore, rankByQuery, searchNodes } from '../searchMatch';

const node = (
  id: string,
  type: string,
  title: string,
  config?: Record<string, unknown>
): RfNode => ({
  id,
  type,
  position: { x: 0, y: 0 },
  data: { workflow: { title, ...(config ? { config } : {}) } },
});

describe('searchNodes', () => {
  const nodes: RfNode[] = [
    node('a', 'shell', 'Restart nginx', { command: 'systemctl restart nginx' }),
    node('b', 'operari.httpRequest', 'Page on-call', { url: 'https://api.pagerduty.com' }),
    node('c', 'ssh', 'SSH to box', { host: 'prod-1', username: 'deploy' }),
    node('frame', 'custom.frame', 'Section'),
    node('note', 'custom.note', 'Reminder'),
  ];

  it('returns empty for empty query', () => {
    expect(searchNodes('', nodes)).toEqual([]);
    expect(searchNodes('   ', nodes)).toEqual([]);
  });

  it('matches on title (case-insensitive)', () => {
    const matches = searchNodes('NGINX', nodes);
    expect(matches.map(m => m.id)).toEqual(['a']);
  });

  it('matches on config primary preview', () => {
    const matches = searchNodes('pagerduty', nodes);
    expect(matches.map(m => m.id)).toEqual(['b']);
  });

  it('matches on type id', () => {
    const matches = searchNodes('httpRequest', nodes);
    expect(matches.map(m => m.id)).toEqual(['b']);
  });

  it('skips frames and notes', () => {
    expect(searchNodes('section', nodes)).toEqual([]);
    expect(searchNodes('reminder', nodes)).toEqual([]);
  });

  it('ranks better matches first when multiple nodes match', () => {
    // 's' would loosely match many haystacks; the test confirms the
    // result is ordered by score (highest first), not input order.
    const matches = searchNodes('ssh', nodes);
    expect(matches[0]?.id).toBe('c');
  });
});

describe('ngramScore', () => {
  it('returns 0 for empty query', () => {
    expect(ngramScore('', 'anything')).toBe(0);
  });

  it('returns 0 when query has no overlap', () => {
    expect(ngramScore('xyz', 'restart nginx')).toBe(0);
  });

  it('scores higher for boundary matches than mid-word at equal length', () => {
    // Compare equal-length haystacks: "ssh access here" puts "ssh"
    // at index 0 (boundary), "less ssh hint" puts it mid-string but
    // also at a boundary (after a space), so we compare against a
    // string where every "ssh" lands mid-word.
    const boundary = ngramScore('ssh', 'ssh   command');
    const midWord = ngramScore('ssh', 'asshatxxxxxxx');
    expect(boundary).toBeGreaterThan(midWord);
  });

  it('rewards 4-grams more than 2-grams', () => {
    // Both haystacks contain "shell" but only one shares the longer
    // overlap. Longer n-grams ⇒ more points.
    const four = ngramScore('shell', 'shell command');
    const two = ngramScore('sh', 'sh command');
    expect(four).toBeGreaterThan(two);
  });

  it('normalizes by haystack length (short names win on equal hits)', () => {
    const short = ngramScore('http', 'http');
    const long = ngramScore('http', 'http with a much longer haystack');
    expect(short).toBeGreaterThan(long);
  });
});

describe('rankByQuery', () => {
  const items = [
    { id: 'a', label: 'Shell command' },
    { id: 'b', label: 'HTTP request' },
    { id: 'c', label: 'SSH command' },
  ];

  it('returns input order with score 0 for empty query', () => {
    const out = rankByQuery('', items, i => i.label);
    expect(out.map(r => r.item.id)).toEqual(['a', 'b', 'c']);
    expect(out.every(r => r.score === 0)).toBe(true);
  });

  it('filters and ranks by query (shorter haystack wins on equal hits)', () => {
    // 'Shell command' (13) and 'SSH command' (11) both contain
    // "command" at a boundary. Shorter haystack scores higher because
    // the n-gram tier divides by length — explains the c, a order.
    const out = rankByQuery('command', items, i => i.label);
    expect(out.map(r => r.item.id)).toEqual(['c', 'a']);
  });

  it('returns [] when nothing matches', () => {
    const out = rankByQuery('zzz', items, i => i.label);
    expect(out).toEqual([]);
  });
});
