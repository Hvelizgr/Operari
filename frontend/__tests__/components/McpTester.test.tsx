import { fireEvent, render, screen, waitFor } from '@testing-library/react';

import PendingHttpStepBanner from '@/components/Editor/PendingHttpStepBanner';
import McpTesterCanvas from '@/components/McpTester/McpTesterCanvas';

const MCP_KEY = 'operari:pendingMcpStep';

const inspection = {
  server: { name: 'fake', version: '1.0' },
  instructions: null,
  tools: [
    {
      name: 'restart_service',
      description: 'Restart a systemd unit',
      inputSchema: { properties: { unit: { type: 'string' }, force: { type: 'boolean' } } },
      annotations: { destructiveHint: true },
      hash: 'abcd1234abcd1234',
    },
  ],
  resources: [],
  prompts: [],
  durationMs: 12,
};

function mockFetch() {
  const calls: Array<{ url: string; body: unknown }> = [];
  global.fetch = jest.fn(async (url: RequestInfo | URL, init?: RequestInit) => {
    const u = String(url);
    calls.push({ url: u, body: init?.body ? JSON.parse(String(init.body)) : undefined });
    const data = u.includes('/connected-accounts')
      ? [{ id: 'acc-1', displayName: 'Prod MCP', metadata: { url: 'https://mcp.example.com' } }]
      : u.endsWith('/inspect')
        ? inspection
        : { result: { content: [{ type: 'text', text: 'restarted nginx' }] }, durationMs: 40 };
    return { ok: true, json: async () => ({ data }) } as Response;
  }) as jest.Mock;
  return calls;
}

beforeEach(() => window.localStorage.clear());

describe('McpTesterCanvas', () => {
  it('connects, prefills arguments from the schema, calls a tool and shows its text', async () => {
    const calls = mockFetch();
    render(<McpTesterCanvas lang="en" />);

    fireEvent.change(screen.getByLabelText('Server URL'), {
      target: { value: 'https://mcp.example.com/mcp' },
    });
    fireEvent.click(screen.getByRole('button', { name: /connect/i }));
    fireEvent.click(await screen.findByText('restart_service'));

    expect(screen.getByText(/destructive · declared by the server/)).toBeInTheDocument();
    const args = screen.getByLabelText('Arguments (JSON)') as HTMLTextAreaElement;
    expect(JSON.parse(args.value)).toEqual({ unit: '', force: false });

    fireEvent.change(args, { target: { value: '{"unit":"nginx"}' } });
    fireEvent.click(screen.getByRole('button', { name: /call tool/i }));
    expect(await screen.findByText('restarted nginx')).toBeInTheDocument();

    const call = calls.find(c => c.url.endsWith('/call'))!;
    expect(call.body).toEqual({
      url: 'https://mcp.example.com/mcp',
      name: 'restart_service',
      arguments: { unit: 'nginx' },
    });
  });

  it('hands the tool to the editor pinned to its hash, with the credential but no typed token', async () => {
    mockFetch();
    render(<McpTesterCanvas lang="en" />);
    await waitFor(() =>
      expect(screen.getByRole('option', { name: 'Prod MCP' })).toBeInTheDocument()
    );
    fireEvent.change(screen.getByLabelText('Saved server'), { target: { value: 'acc-1' } });
    fireEvent.click(screen.getByRole('button', { name: /connect/i }));
    fireEvent.click(await screen.findByText('restart_service'));
    fireEvent.click(screen.getByRole('button', { name: /to runbook/i }));

    const stored = JSON.parse(window.localStorage.getItem(MCP_KEY)!);
    expect(stored.type).toBe('mcp.callTool');
    expect(stored.config).toMatchObject({
      credential: '{{secrets.acc-1}}',
      tool: 'restart_service',
      toolHash: 'abcd1234abcd1234',
    });
    expect(JSON.stringify(stored)).not.toMatch(/token/i);
  });

  it('blocks the call while the arguments are not a JSON object', async () => {
    mockFetch();
    render(<McpTesterCanvas lang="en" />);
    fireEvent.change(screen.getByLabelText('Server URL'), { target: { value: 'https://x/mcp' } });
    fireEvent.click(screen.getByRole('button', { name: /connect/i }));
    fireEvent.click(await screen.findByText('restart_service'));
    fireEvent.change(screen.getByLabelText('Arguments (JSON)'), { target: { value: '[1,2]' } });
    expect(screen.getByRole('button', { name: /call tool/i })).toBeDisabled();
  });
});

describe('PendingHttpStepBanner with an MCP step', () => {
  it('offers the stashed MCP tool and passes the whole step on import', () => {
    const step = {
      type: 'mcp.callTool',
      config: { tool: 'restart_service', arguments: '{}', toolHash: 'abcd' },
      server: 'fake',
      createdAt: Date.now(),
    };
    window.localStorage.setItem(MCP_KEY, JSON.stringify(step));
    const onImport = jest.fn();
    render(<PendingHttpStepBanner lang="en" onImport={onImport} />);
    expect(screen.getByText('restart_service · fake')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /insert as step/i }));
    expect(onImport).toHaveBeenCalledWith(step);
    expect(window.localStorage.getItem(MCP_KEY)).toBeNull();
  });
});
