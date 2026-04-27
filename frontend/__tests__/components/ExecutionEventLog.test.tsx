import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';

import ExecutionEventLog, { type ExecutionEventRow } from '@/components/Runs/ExecutionEventLog';

const fetchMock = jest.fn();

// EventSource fake that captures the last-constructed instance so
// tests can drive SSE messages from outside. Kept minimal — we only
// need onmessage + onerror + close.
class FakeEventSource {
  static instances: FakeEventSource[] = [];
  url: string;
  onmessage: ((ev: { data: string }) => void) | null = null;
  onerror: (() => void) | null = null;
  closed = false;
  constructor(url: string) {
    this.url = url;
    FakeEventSource.instances.push(this);
  }
  close() {
    this.closed = true;
  }
  emit(entry: ExecutionEventRow) {
    this.onmessage?.({ data: JSON.stringify(entry) });
  }
  fail() {
    this.onerror?.();
  }
}

beforeEach(() => {
  (global as unknown as { fetch: unknown }).fetch = fetchMock;
  fetchMock.mockReset();
  FakeEventSource.instances.length = 0;
  (global as unknown as { EventSource: typeof FakeEventSource | undefined }).EventSource =
    FakeEventSource;
});

afterEach(() => {
  (global as unknown as { EventSource: unknown }).EventSource = undefined;
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
    expect(await screen.findByText('run.started')).toBeInTheDocument();

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

  it('opens an EventSource in live mode and appends SSE messages in order', async () => {
    fetchMock.mockResolvedValue(respond({ data: [], nextAfterSeq: null }));
    render(<ExecutionEventLog runId="run-1" lang="en" live />);
    await waitFor(() => expect(fetchMock).toHaveBeenCalled());

    // Exactly one stream connection opened at the expected URL.
    expect(FakeEventSource.instances).toHaveLength(1);
    const source = FakeEventSource.instances[0];
    expect(source.url).toMatch(/\/api\/runs\/run-1\/events\/stream$/);

    act(() => {
      source.emit({
        seq: '1',
        type: 'run.started',
        nodeId: null,
        payload: {},
        createdAt: '2026-04-24T00:00:00Z',
      });
      source.emit({
        seq: '2',
        type: 'step.completed',
        nodeId: 'node-a',
        payload: { nodeName: 'Fetch', durationMs: 1500 },
        createdAt: '2026-04-24T00:00:02Z',
      });
    });

    expect(await screen.findByText('run.started')).toBeInTheDocument();
    expect(await screen.findByText('Fetch · 1.5s')).toBeInTheDocument();
  });

  it('closes SSE on unmount so we do not leak the connection', async () => {
    fetchMock.mockResolvedValue(respond({ data: [], nextAfterSeq: null }));
    const { unmount } = render(<ExecutionEventLog runId="run-1" lang="en" live />);
    await waitFor(() => expect(FakeEventSource.instances).toHaveLength(1));
    const source = FakeEventSource.instances[0];
    expect(source.closed).toBe(false);
    unmount();
    expect(source.closed).toBe(true);
  });

  it('honours the active preset when an SSE message arrives', async () => {
    fetchMock.mockResolvedValue(respond({ data: [], nextAfterSeq: null }));
    render(<ExecutionEventLog runId="run-1" lang="en" live />);
    await waitFor(() => expect(FakeEventSource.instances).toHaveLength(1));

    // Switch the filter to "errors"; a new EventSource should open
    // because the effect re-runs. We push a non-error event and
    // expect it to be dropped client-side.
    fireEvent.click(screen.getByRole('button', { name: 'Errors' }));
    await waitFor(() => expect(FakeEventSource.instances.length).toBeGreaterThanOrEqual(2));
    const source = FakeEventSource.instances[FakeEventSource.instances.length - 1];

    act(() => {
      source.emit({
        seq: '10',
        type: 'step.started',
        nodeId: 'n',
        payload: {},
        createdAt: '2026-04-24T00:00:00Z',
      });
      source.emit({
        seq: '11',
        type: 'step.failed',
        nodeId: 'n',
        payload: { errorMessage: 'boom' },
        createdAt: '2026-04-24T00:00:01Z',
      });
    });
    // Only the failure row should be visible; step.started is below
    // the "errors" filter threshold.
    expect(await screen.findByText('step.failed')).toBeInTheDocument();
    expect(screen.queryByText('step.started')).not.toBeInTheDocument();
  });

  it('auto-expands .failed events so the error payload is visible immediately', async () => {
    fetchMock.mockResolvedValue(
      respond({
        data: [
          mkEvent({
            seq: '5',
            type: 'step.failed',
            nodeId: 'node-a',
            payload: { errorMessage: 'timeout after 30s', nodeName: 'Validate' },
          }),
        ],
        nextAfterSeq: null,
      })
    );
    render(<ExecutionEventLog runId="run-1" lang="en" />);
    // No click needed — the failure's payload is already open.
    expect(await screen.findByText(/"errorMessage": "timeout after 30s"/)).toBeInTheDocument();
  });

  it('does not re-expand a failure the user explicitly collapsed', async () => {
    // First render populates the list and auto-expands the failure.
    fetchMock.mockResolvedValue(
      respond({
        data: [
          mkEvent({
            seq: '5',
            type: 'step.failed',
            nodeId: 'node-a',
            payload: { errorMessage: 'timeout after 30s', nodeName: 'Validate' },
          }),
          mkEvent({
            seq: '6',
            type: 'run.failed',
            nodeId: null,
            payload: { errorMessage: 'run aborted', durationMs: 30000 },
          }),
        ],
        nextAfterSeq: null,
      })
    );
    render(<ExecutionEventLog runId="run-1" lang="en" />);
    await waitFor(() => expect(fetchMock).toHaveBeenCalled());

    // Both failures should be open initially.
    expect(await screen.findByText(/"errorMessage": "timeout after 30s"/)).toBeInTheDocument();

    // User collapses the step.failed row by clicking its header.
    fireEvent.click(screen.getByText('step.failed'));
    await waitFor(() =>
      expect(screen.queryByText(/"errorMessage": "timeout after 30s"/)).not.toBeInTheDocument()
    );
    // The run.failed one stays open — other rows are untouched.
    expect(screen.getByText(/"errorMessage": "run aborted"/)).toBeInTheDocument();
  });

  it('exposes a Stop button in live mode that posts to /cancel', async () => {
    fetchMock.mockResolvedValue(respond({ data: [], nextAfterSeq: null }));
    // jsdom has no real window.confirm; force-accept so the cancel
    // flow can proceed without a mouse click.
    const confirmSpy = jest.spyOn(window, 'confirm').mockReturnValue(true);
    render(<ExecutionEventLog runId="run-42" lang="en" live />);
    await waitFor(() => expect(fetchMock).toHaveBeenCalled());

    const stop = screen.getByRole('button', { name: /stop/i });
    fireEvent.click(stop);

    await waitFor(() => {
      const call = fetchMock.mock.calls.find(args =>
        (args[0] as string).includes('/api/executions/run-42/cancel')
      );
      expect(call).toBeDefined();
      expect((call as unknown as [string, { method: string }])[1].method).toBe('POST');
    });
    confirmSpy.mockRestore();
  });

  it('does nothing when Stop is declined in the confirm dialog', async () => {
    fetchMock.mockResolvedValue(respond({ data: [], nextAfterSeq: null }));
    const confirmSpy = jest.spyOn(window, 'confirm').mockReturnValue(false);
    render(<ExecutionEventLog runId="run-42" lang="en" live />);
    await waitFor(() => expect(fetchMock).toHaveBeenCalled());

    fireEvent.click(screen.getByRole('button', { name: /stop/i }));
    // No cancel call ever leaves the client when confirm is rejected
    // — the only fetch we saw is the initial backlog.
    expect(fetchMock.mock.calls.some(args => (args[0] as string).includes('/cancel'))).toBe(false);
    confirmSpy.mockRestore();
  });

  it('hides the Stop button when the run is not live', async () => {
    fetchMock.mockResolvedValue(respond({ data: [], nextAfterSeq: null }));
    render(<ExecutionEventLog runId="run-42" lang="en" />);
    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    expect(screen.queryByRole('button', { name: /stop/i })).not.toBeInTheDocument();
  });

  it('shows a retry button inline on step.failed rows and posts to /replay on confirm', async () => {
    fetchMock.mockImplementation(async (url: string) => {
      if (url.includes('/replay')) {
        return {
          ok: true,
          status: 200,
          json: async () => ({ id: 'run-new' }),
        };
      }
      return respond({
        data: [
          mkEvent({
            seq: '9',
            type: 'step.failed',
            nodeId: 'node-a',
            payload: { nodeName: 'Validate', errorMessage: 'oops' },
          }),
        ],
        nextAfterSeq: null,
      });
    });
    const confirmSpy = jest.spyOn(window, 'confirm').mockReturnValue(true);

    render(<ExecutionEventLog runId="run-old" lang="en" />);

    // Auto-expanded by the failure-expand effect — button is visible.
    const retry = await screen.findByRole('button', { name: /retry from this step/i });
    fireEvent.click(retry);

    await waitFor(() => {
      const call = fetchMock.mock.calls.find(args =>
        (args[0] as string).includes('/api/executions/run-old/replay')
      );
      expect(call).toBeDefined();
      const [, init] = call as unknown as [string, { method: string; body: string }];
      expect(init.method).toBe('POST');
      expect(JSON.parse(init.body)).toEqual({ nodeId: 'node-a' });
    });

    // Success banner surfaces with a "View new run →" link to the
    // returned run id so the operator can hop to the new execution.
    const link = await screen.findByRole('link', { name: /view new run/i });
    expect(link).toHaveAttribute('href', '/en/runs/run-new');
    confirmSpy.mockRestore();
  });

  it('disables the retry button while the run is live', async () => {
    fetchMock.mockResolvedValue(
      respond({
        data: [
          mkEvent({
            seq: '9',
            type: 'step.failed',
            nodeId: 'node-a',
            payload: { errorMessage: 'oops' },
          }),
        ],
        nextAfterSeq: null,
      })
    );
    render(<ExecutionEventLog runId="run-1" lang="en" live />);
    const retry = await screen.findByRole('button', { name: /retry from this step/i });
    expect(retry).toBeDisabled();
  });

  it('does not render a retry button on non-failure events', async () => {
    fetchMock.mockResolvedValue(
      respond({
        data: [mkEvent({ seq: '1', type: 'step.completed', nodeId: 'node-a', payload: {} })],
        nextAfterSeq: null,
      })
    );
    render(<ExecutionEventLog runId="run-1" lang="en" />);
    // Force-expand the row so any retry UI underneath would be revealed.
    fireEvent.click(await screen.findByText('step.completed'));
    expect(screen.queryByRole('button', { name: /retry from this step/i })).not.toBeInTheDocument();
  });

  it('reveals the "Jump to latest" pill when the user scrolls away from the tail', async () => {
    fetchMock.mockResolvedValue(
      respond({
        data: [
          mkEvent({ seq: '1', type: 'step.started', nodeId: 'n', payload: {} }),
          mkEvent({ seq: '2', type: 'step.started', nodeId: 'n2', payload: {} }),
        ],
        nextAfterSeq: null,
      })
    );
    const { container } = render(<ExecutionEventLog runId="run-1" lang="en" />);
    await waitFor(() => expect(screen.getAllByText('step.started').length).toBeGreaterThan(0));

    // Not visible before the user scrolls — autoFollow starts true.
    expect(screen.queryByText('Jump to latest')).not.toBeInTheDocument();

    // jsdom doesn't derive scroll geometry; stub the values that the
    // onScroll handler reads (scrollHeight - clientHeight - scrollTop).
    // 1000-200-100 = 700, well above the 48 px threshold, so the
    // handler should flip autoFollow off.
    const scrollEl = container.querySelector('.max-h-\\[560px\\]') as HTMLDivElement;
    expect(scrollEl).toBeTruthy();
    Object.defineProperty(scrollEl, 'scrollHeight', { configurable: true, value: 1000 });
    Object.defineProperty(scrollEl, 'clientHeight', { configurable: true, value: 200 });
    Object.defineProperty(scrollEl, 'scrollTop', {
      configurable: true,
      value: 100,
      writable: true,
    });
    fireEvent.scroll(scrollEl);

    expect(await screen.findByText('Jump to latest')).toBeInTheDocument();

    // Clicking the pill re-pins to the bottom and hides itself.
    // AnimatePresence now wraps the pill so the DOM element persists
    // through the exit animation — use waitFor to observe removal.
    fireEvent.click(screen.getByRole('button', { name: /jump to latest/i }));
    expect(scrollEl.scrollTop).toBe(1000);
    await waitFor(() => {
      expect(screen.queryByText('Jump to latest')).not.toBeInTheDocument();
    });
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
