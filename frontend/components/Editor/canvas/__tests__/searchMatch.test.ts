import type { RfNode } from '@/lib/canvas/adapter';

import { searchNodes } from '../searchMatch';

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

  it('preserves input order in matches', () => {
    const matches = searchNodes('s', nodes);
    expect(matches.map(m => m.id)).toEqual(['a', 'b', 'c']);
  });
});
