import { render, screen } from '@testing-library/react';

import SessionsBoard, { type BoardRun, groupRuns } from '../../components/Runs/SessionsBoard';

const run = (id: string, status: BoardRun['status'], over: Partial<BoardRun> = {}): BoardRun => ({
  id,
  runbook: { id: 'rb', slug: null, name: `rb-${id}` },
  status,
  trigger: 'MANUAL',
  startedAt: new Date(Date.now() - 60_000).toISOString(),
  completedAt: status === 'RUNNING' || status === 'PAUSED' ? null : new Date().toISOString(),
  duration: 1000,
  error: status === 'FAILED' ? 'boom' : null,
  ...over,
});

describe('groupRuns', () => {
  it('sorts runs into running, waiting and recently finished', () => {
    const old = run('old', 'SUCCESS', {
      completedAt: new Date(Date.now() - 2 * 864e5).toISOString(),
    });
    const g = groupRuns(
      [run('a', 'RUNNING'), run('b', 'PAUSED'), run('c', 'FAILED'), old],
      Date.now()
    );
    expect(g.running.map(r => r.id)).toEqual(['a']);
    expect(g.waiting.map(r => r.id)).toEqual(['b']);
    expect(g.finished.map(r => r.id)).toEqual(['c']);
  });
});

describe('SessionsBoard', () => {
  const realFetch = globalThis.fetch;
  afterEach(() => {
    globalThis.fetch = realFetch;
  });

  it('shows a paused run with a link to review it', async () => {
    globalThis.fetch = jest.fn(async () => ({
      ok: true,
      json: async () => ({ data: [run('p', 'PAUSED'), run('f', 'FAILED')] }),
    })) as unknown as typeof fetch;
    render(<SessionsBoard lang="en" />);
    expect(await screen.findByText('rb-p')).toBeInTheDocument();
    expect(screen.getByText(/Review in Inbox/)).toBeInTheDocument();
    expect(screen.getByText('boom')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /rb-p/ })).toHaveAttribute('href', '/en/runs/p');
  });
});
