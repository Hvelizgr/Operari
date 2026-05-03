import { fireEvent, render, screen, waitFor } from '@testing-library/react';

import { WebhookUrlPanel } from '@/components/Editor/WebhookUrlPanel';
import { useEditorStore } from '@/state/editorStore';

const realFetch = globalThis.fetch;

afterEach(() => {
  globalThis.fetch = realFetch;
  // Reset the store between tests so a stale runbookId from one
  // test does not bleed into the next.
  useEditorStore.setState({ runbookId: null });
  jest.clearAllMocks();
});

beforeEach(() => {
  // Mock the clipboard API since jsdom does not provide it.
  Object.defineProperty(navigator, 'clipboard', {
    configurable: true,
    value: { writeText: jest.fn().mockResolvedValue(undefined) },
  });
});

const setRunbook = (id: string | null): void => {
  useEditorStore.setState({ runbookId: id });
};

describe('WebhookUrlPanel', () => {
  it('shows the empty state when the runbook has no webhook yet', async () => {
    setRunbook('rb-1');
    globalThis.fetch = jest.fn(async () => ({
      ok: true,
      json: async () => ({ data: [] }),
    })) as unknown as typeof fetch;

    render(<WebhookUrlPanel lang="en" />);
    expect(await screen.findByText(/no webhook is registered/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /create webhook/i })).toBeEnabled();
  });

  it('renders the URL + secret when a webhook exists', async () => {
    setRunbook('rb-1');
    globalThis.fetch = jest.fn(async () => ({
      ok: true,
      json: async () => ({
        data: [
          {
            id: 'wh-1',
            runbookId: 'rb-1',
            source: 'generic',
            url: 'https://api.example.com/webhook/abc123',
            secret: 'whk_supersecret',
            isActive: true,
            triggerCount: 0,
            lastTriggeredAt: null,
            createdAt: '2026-04-29T00:00:00Z',
          },
        ],
      }),
    })) as unknown as typeof fetch;

    render(<WebhookUrlPanel lang="en" />);
    expect(await screen.findByText('https://api.example.com/webhook/abc123')).toBeInTheDocument();
    expect(screen.getByText('whk_supersecret')).toBeInTheDocument();
  });

  it('copies the URL via the clipboard API on click', async () => {
    setRunbook('rb-1');
    globalThis.fetch = jest.fn(async () => ({
      ok: true,
      json: async () => ({
        data: [
          {
            id: 'wh-1',
            runbookId: 'rb-1',
            source: 'generic',
            url: 'https://api.example.com/webhook/abc123',
            secret: null,
            isActive: true,
            triggerCount: 0,
            lastTriggeredAt: null,
            createdAt: 't',
          },
        ],
      }),
    })) as unknown as typeof fetch;

    render(<WebhookUrlPanel lang="en" />);
    await screen.findByText('https://api.example.com/webhook/abc123');
    fireEvent.click(screen.getByLabelText(/copy url/i));
    await waitFor(() => {
      expect(navigator.clipboard.writeText).toHaveBeenCalledWith(
        'https://api.example.com/webhook/abc123'
      );
    });
  });

  it('flags inactive webhooks with a chip', async () => {
    setRunbook('rb-1');
    globalThis.fetch = jest.fn(async () => ({
      ok: true,
      json: async () => ({
        data: [
          {
            id: 'wh-2',
            runbookId: 'rb-1',
            source: 'generic',
            url: 'https://api.example.com/webhook/x',
            secret: null,
            isActive: false,
            triggerCount: 0,
            lastTriggeredAt: null,
            createdAt: 't',
          },
        ],
      }),
    })) as unknown as typeof fetch;

    render(<WebhookUrlPanel lang="en" />);
    expect(await screen.findByText(/inactive/i)).toBeInTheDocument();
  });

  it('blocks the create button + shows a hint when no runbook is loaded', async () => {
    setRunbook(null);
    globalThis.fetch = jest.fn(async () => ({
      ok: true,
      json: async () => ({ data: [] }),
    })) as unknown as typeof fetch;

    render(<WebhookUrlPanel lang="en" />);
    const createBtn = await screen.findByRole('button', { name: /create webhook/i });
    expect(createBtn).toBeDisabled();
  });
});
