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
            type: 'step.failed',
            nodeId: 'node-a',
            payload: { errorMessage: 'timeout after 30s' },
          }),
        ],
        nextAfterSeq: null,
      })
    );
    render(<ExecutionEventLog runId="run-1" lang="en" />);
    await waitFor(() => expect(screen.getByText('step.failed')).toBeInTheDocument());

    // Payload is hidden until the row is expanded.
    expect(screen.queryByText(/timeout after 30s/)).not.toBeInTheDocument();
    // The row button is the one that renders the event type; clicking
    // toggles expansion.
    fireEvent.click(screen.getByText('step.failed'));
    expect(await screen.findByText(/timeout after 30s/)).toBeInTheDocument();
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
