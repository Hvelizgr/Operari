import { createServer, type Server } from 'http';
import type { AddressInfo } from 'net';

export interface FakeTool {
  name: string;
  description?: string;
  inputSchema: Record<string, unknown>;
  reply: (args: Record<string, unknown>) => { text: string; isError?: boolean };
}

export interface FakeMcpServer {
  url: string;
  /** Authorization headers seen on each JSON-RPC request. */
  auth: string[];
  tools: FakeTool[];
  close(): Promise<void>;
}

/**
 * A 2025-era MCP server over Streamable HTTP, JSON responses only. It
 * answers the 2026 `server/discover` probe with "method not found", which
 * is the legacy signal the client falls back on.
 */
export async function startFakeMcpServer(tools: FakeTool[]): Promise<FakeMcpServer> {
  const auth: string[] = [];
  const server: Server = createServer((req, res) => {
    if (req.method !== 'POST') {
      res.writeHead(405).end();
      return;
    }
    let raw = '';
    req.on('data', chunk => (raw += chunk));
    req.on('end', () => {
      auth.push(String(req.headers.authorization ?? ''));
      const msg = JSON.parse(raw) as { id?: number; method: string; params?: any };
      if (msg.id === undefined) {
        res.writeHead(202).end();
        return;
      }
      const reply = (body: Record<string, unknown>) => {
        res.writeHead(200, { 'Content-Type': 'application/json', 'Mcp-Session-Id': 's-1' });
        res.end(JSON.stringify({ jsonrpc: '2.0', id: msg.id, ...body }));
      };
      switch (msg.method) {
        case 'initialize':
          return reply({
            result: {
              protocolVersion: '2025-06-18',
              capabilities: { tools: {} },
              serverInfo: { name: 'fake', version: '0.0.1' },
              instructions: 'test server',
            },
          });
        case 'tools/list':
          return reply({
            result: {
              tools: tools.map(({ reply: _r, ...t }) => t),
            },
          });
        case 'tools/call': {
          const tool = tools.find(t => t.name === msg.params?.name);
          if (!tool) return reply({ error: { code: -32602, message: 'unknown tool' } });
          const out = tool.reply(msg.params?.arguments ?? {});
          return reply({
            result: { content: [{ type: 'text', text: out.text }], isError: out.isError ?? false },
          });
        }
        default:
          return reply({ error: { code: -32601, message: 'Method not found' } });
      }
    });
  });
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address() as AddressInfo;
  return {
    url: `http://127.0.0.1:${port}/mcp`,
    auth,
    tools,
    close: () => new Promise(resolve => server.close(() => resolve())),
  };
}

export const ECHO_TOOL: FakeTool = {
  name: 'echo',
  description: 'Echo the message back',
  inputSchema: { type: 'object', properties: { message: { type: 'string' } } },
  reply: args => ({ text: `echo: ${String(args.message ?? '')}` }),
};

export const BROKEN_TOOL: FakeTool = {
  name: 'broken',
  inputSchema: { type: 'object' },
  reply: () => ({ text: 'disk full', isError: true }),
};
