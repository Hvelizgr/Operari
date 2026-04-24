import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';

import WebhookReceiptsPanel from '@/components/Editor/WebhookReceiptsPanel';

/**
 * Mock fetch for every test. Each test can replace the implementation
 * via `(fetchMock as jest.Mock).mockImplementation(...)`.
 */
const fetchMock = jest.fn();

beforeEach(() => {
  (global as any).fetch = fetchMock;
  fetchMock.mockReset();
});

function respond(body: unknown): any {
  return {
    ok: true,
    status: 200,
    json: async () => body,
  };
}

const sampleReceipts = (ids: string[], status = 'accepted') =>
  ids.map((id, i) => ({
    id,
    webhookId: 'wh-1',
    status,
    statusCode: 202,
    reason: null,
    headers: {},
    body: {},
    sourceIp: null,
    executionId: null,
    receivedAt: new Date(Date.UTC(2026, 3, 24 - i)).toISOString(),
  }));

describe('WebhookReceiptsPanel', () => {
  it('fetches with default params when opened', async () => {
    fetchMock.mockResolvedValue(respond({ data: sampleReceipts(['r1', 'r2']), nextCursor: null }));

    render(<WebhookReceiptsPanel lang="en" webhookId="wh-1" />);
    fireEvent.click(screen.getByText('Show receipts'));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledTimes(1);
    });

    const url = (fetchMock.mock.calls[0] as [string])[0];
    expect(url).toContain('/api/webhooks/wh-1/receipts');
    expect(url).toContain('limit=25');
    expect(url).not.toContain('status=');
    expect(url).not.toContain('cursor=');
  });

  it('applies the "Failed" filter to the status query param', async () => {
    fetchMock.mockResolvedValue(respond({ data: [], nextCursor: null }));

    render(<WebhookReceiptsPanel lang="en" webhookId="wh-1" />);
    fireEvent.click(screen.getByText('Show receipts'));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));

    fireEvent.click(screen.getByRole('button', { name: 'Failed' }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));

    const url = (fetchMock.mock.calls[1] as [string])[0];
    const params = new URLSearchParams(url.split('?')[1]);
    expect(params.get('status')).toBe('rejected_signature,rejected_inactive,error');
  });

  it('renders "Load older" only when nextCursor is present', async () => {
    fetchMock.mockResolvedValue(respond({ data: sampleReceipts(['r1']), nextCursor: null }));

    render(<WebhookReceiptsPanel lang="en" webhookId="wh-1" />);
    fireEvent.click(screen.getByText('Show receipts'));

    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    expect(screen.queryByText('Load older')).toBeNull();
  });

  it('appends older receipts on "Load older" and sends the cursor', async () => {
    const firstCursor = '2026-04-22T00:00:00.000Z';
    fetchMock
      .mockResolvedValueOnce(
        respond({ data: sampleReceipts(['r1', 'r2']), nextCursor: firstCursor })
      )
      .mockResolvedValueOnce(respond({ data: sampleReceipts(['r3']), nextCursor: null }));

    render(<WebhookReceiptsPanel lang="en" webhookId="wh-1" />);
    fireEvent.click(screen.getByText('Show receipts'));

    await waitFor(() => expect(screen.getByText('Load older')).toBeInTheDocument());

    await act(async () => {
      fireEvent.click(screen.getByText('Load older'));
    });

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
    const secondUrl = (fetchMock.mock.calls[1] as [string])[0];
    const params = new URLSearchParams(secondUrl.split('?')[1]);
    expect(params.get('cursor')).toBe(firstCursor);
    // Load-more button hidden once the server stops returning a cursor.
    await waitFor(() => expect(screen.queryByText('Load older')).toBeNull());
  });

  it('shows the empty-filtered message when the filter returns no rows', async () => {
    // First call (default 'all'): 1 row so panel opens with content.
    // Second call (after filter flip to 'failed'): empty data.
    fetchMock
      .mockResolvedValueOnce(respond({ data: sampleReceipts(['r1']), nextCursor: null }))
      .mockResolvedValueOnce(respond({ data: [], nextCursor: null }));

    render(<WebhookReceiptsPanel lang="en" webhookId="wh-1" />);
    fireEvent.click(screen.getByText('Show receipts'));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));

    fireEvent.click(screen.getByRole('button', { name: 'Failed' }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));

    expect(screen.getByText('No receipts match this filter.')).toBeInTheDocument();
  });

  it('shows load-error message when the fetch fails', async () => {
    fetchMock.mockRejectedValue(new Error('network down'));

    render(<WebhookReceiptsPanel lang="en" webhookId="wh-1" />);
    fireEvent.click(screen.getByText('Show receipts'));

    await waitFor(() => expect(screen.getByText('Could not load receipts.')).toBeInTheDocument());
  });
});
