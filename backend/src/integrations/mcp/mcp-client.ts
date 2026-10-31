import {
  type CallToolResult,
  Client,
  type Implementation,
  type ListToolsResult,
  StreamableHTTPClientTransport,
} from '@modelcontextprotocol/client';
import { createHash } from 'crypto';

import { blockedTarget, guardedFetch } from '../../security/ssrf-guard';

/** Where an MCP server lives and how to authenticate to it. */
export interface McpTarget {
  url: string;
  /** Sent as `Authorization: Bearer`. */
  token?: string;
}

export type McpTool = ListToolsResult['tools'][number];

export interface McpServerInfo {
  server: Implementation | null;
  instructions: string | null;
  capabilities: Record<string, unknown>;
}

export class McpTargetError extends Error {}

const DEFAULT_TIMEOUT_MS = 30_000;
// Pagination guard: a server that keeps handing back cursors is broken,
// not a reason to loop forever inside a run.
const MAX_TOOL_PAGES = 20;

export function mcpUrl(raw: string): string {
  const url = raw.trim();
  if (!/^https?:\/\//i.test(url)) {
    throw new McpTargetError('MCP server URL must start with http:// or https://');
  }
  return url;
}

/**
 * Opens a Streamable HTTP session for one unit of work and always closes
 * it. Every request — the 2026 discovery probe, the legacy initialize and
 * each call — goes through the SSRF guard, redirects included.
 */
export async function withMcpClient<T>(
  target: McpTarget,
  work: (client: Client) => Promise<T>,
  { timeoutMs = DEFAULT_TIMEOUT_MS, httpFetch = fetch } = {}
): Promise<T> {
  const url = mcpUrl(target.url);
  const blocked = await blockedTarget('url', url);
  if (blocked) throw new McpTargetError(blocked);

  const transport = new StreamableHTTPClientTransport(new URL(url), {
    fetch: (input, init) =>
      guardedFetch(httpFetch, String(input instanceof Request ? input.url : input), init ?? {}),
    requestInit: target.token ? { headers: { Authorization: `Bearer ${target.token}` } } : {},
  });
  const client = new Client(
    { name: 'operari', version: '1.0.0' },
    { capabilities: {}, versionNegotiation: { mode: 'auto' } }
  );
  try {
    await client.connect(transport, { timeout: timeoutMs });
    return await work(client);
  } finally {
    await client.close().catch(() => undefined);
  }
}

export function serverInfo(client: Client): McpServerInfo {
  return {
    server: client.getServerVersion() ?? null,
    instructions: client.getInstructions() ?? null,
    capabilities: (client.getServerCapabilities() ?? {}) as Record<string, unknown>,
  };
}

export async function listTools(
  client: Client,
  timeoutMs = DEFAULT_TIMEOUT_MS
): Promise<McpTool[]> {
  const tools: McpTool[] = [];
  let cursor: string | undefined;
  for (let page = 0; page < MAX_TOOL_PAGES; page++) {
    const res = await client.listTools(cursor ? { cursor } : undefined, { timeout: timeoutMs });
    tools.push(...res.tools);
    cursor = res.nextCursor;
    if (!cursor) break;
  }
  return tools;
}

export async function callTool(
  client: Client,
  name: string,
  args: Record<string, unknown>,
  timeoutMs = DEFAULT_TIMEOUT_MS
): Promise<CallToolResult> {
  return client.callTool({ name, arguments: args }, { timeout: timeoutMs });
}

/**
 * Fingerprint of what a reviewer approved: the name, description and
 * schemas the model and the form are built from. A server that changes
 * any of them after review ("rug pull") no longer matches.
 */
export function toolHash(tool: McpTool): string {
  const reviewed = {
    name: tool.name,
    description: tool.description ?? '',
    inputSchema: tool.inputSchema ?? {},
    outputSchema: tool.outputSchema ?? null,
  };
  return createHash('sha256').update(stableStringify(reviewed)).digest('hex').slice(0, 16);
}

function stableStringify(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`;
  if (value && typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>)
      .filter(([, v]) => v !== undefined)
      .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
    return `{${entries.map(([k, v]) => `${JSON.stringify(k)}:${stableStringify(v)}`).join(',')}}`;
  }
  return JSON.stringify(value);
}

/** Text blocks of a tool result joined, for logs and `{{steps.x.output.text}}`. */
export function resultText(result: CallToolResult): string {
  return (result.content ?? [])
    .map(block => (block.type === 'text' ? block.text : `[${block.type}]`))
    .join('\n');
}
