import { fireEvent, render, screen, waitFor } from '@testing-library/react';

import ExecutionEventLog, { type ExecutionEventRow } from '@/components/Runs/ExecutionEventLog';

const fetchMock = jest.fn();

beforeEach(() => {
  (global as unknown as { fetch: unknown }).fetch = fetchMock;
  fetchMock.mockReset();
});

function respond(body: unknown) {
  return {
    ok: true,
    status: 200,
    json: async () => body,
  };
}

const mkEvent = (over: Partial<ExecutionEventRow> = {}): ExecutionEventRow => ({
  seq: '1',
  type: 'run.started',
  nodeId: null,
  payload: { startedAt: '2026-04-24T00:00:00Z' },
  createdAt: '2026-04-24T00:00:00Z',
  ...over,
});

describe('ExecutionEventLog', () => {
  it('fetches events for the given runId on mount', async () => {
    fetchMock.mockResolvedValue(respond({ data: [mkEvent()], nextAfterSeq: null }));
    render(<ExecutionEventLog runId="run-1" lang="en" />);

    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    const url = (fetchMock.mock.calls[0] as [string])[0];
    expect(url).toContain('/api/runs/run-1/events');
    // The first fetch has no type filter (preset = all) and no afterSeq
    expect(url).not.toContain('type=');
    expect(url).not.toContain('afterSeq=');
    expect(await screen.findByText('run.started')).toBeInTheDocument();
  });

  it('renders the empty state when the server returns no events', async () => {
    fetchMock.mockResolvedValue(respond({ data: [], nextAfterSeq: null }));
    render(<ExecutionEventLog runId="run-1" lang="en" />);

    expect(await screen.findByText('No events yet.')).toBeInTheDocument();
  });

  it('switches preset to errors and narrows the type filter', async () => {
    fetchMock.mockResolvedValue(respond({ data: [], nextAfterSeq: null }));
    render(<ExecutionEventLog runId="run-1" lang="en" />);
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));

    fireEvent.click(screen.getByRole('button', { name: 'Errors' }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));

    const url = (fetchMock.mock.calls[1] as [string])[0];
    const params = new URLSearchParams(url.split('?')[1]);
    expect(params.get('type')).toBe('run.failed,step.failed');
  });

  it('expands an event to show its payload when clicked', async () => {
    fetchMock.mockResolvedValue(
      respond({
        data: [
          mkEvent({
            seq: '42',
            type: 'run.started',
            nodeId: null,
            // Use a field the summary formatter does not surface
            // (startedAt is informational only) so the assertion
            // that the payload is hidden before expansion still
            // holds after the row-summary feature landed.
            payload: { startedAt: '2026-04-24T12:34:56.000Z' },
          }),
        ],
        nextAfterSeq: null,
      })
    );
    render(<ExecutionEventLog runId="run-1" lang="en" />);
    await waitFor(() => expect(screen.getByText('run.started')).toBeInTheDocument());

    // Payload is hidden until the row is expanded.
    expect(screen.queryByText(/2026-04-24T12:34:56/)).not.toBeInTheDocument();
    fireEvent.click(screen.getByText('run.started'));
    expect(await screen.findByText(/2026-04-24T12:34:56/)).toBeInTheDocument();
  });

  it('renders a one-line summary with node name and duration', async () => {
    fetchMock.mockResolvedValue(
      respond({
        data: [
          mkEvent({
            seq: '7',
            type: 'step.completed',
            nodeId: 'node-abc',
            payload: { nodeName: 'Fetch API', nodeType: 'http', durationMs: 2140 },
          }),
        ],
        nextAfterSeq: null,
      })
    );
    render(<ExecutionEventLog runId="run-1" lang="en" />);
    // Summary merges human-readable node name + formatted duration,
    // not the uuid the event stores.
    expect(await screen.findByText('Fetch API · 2.1s')).toBeInTheDocument();
    // The raw nodeId must not leak into the row (only into the
    // expanded payload JSON).
    expect(screen.queryByText('node-abc')).not.toBeInTheDocument();
  });

  it('uses error message as summary for step.failed', async () => {
    fetchMock.mockResolvedValue(
      respond({
        data: [
          mkEvent({
            seq: '9',
            type: 'step.failed',
            nodeId: 'node-a',
            payload: {
              nodeName: 'Validate',
              nodeType: 'check',
              durationMs: 30_000,
              errorMessage: 'timeout after 30s',
            },
          }),
        ],
        nextAfterSeq: null,
      })
    );
    render(<ExecutionEventLog runId="run-1" lang="en" />);
    expect(await screen.findByText('Validate · timeout after 30s')).toBeInTheDocument();
  });

  it('shows the LIVE badge only when live is true', async () => {
    fetchMock.mockResolvedValue(respond({ data: [], nextAfterSeq: null }));
    const { rerender } = render(<ExecutionEventLog runId="run-1" lang="en" />);
    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    expect(screen.queryByText('LIVE')).not.toBeInTheDocument();

    rerender(<ExecutionEventLog runId="run-1" lang="en" live />);
    expect(await screen.findByText('LIVE')).toBeInTheDocument();
  });
});
