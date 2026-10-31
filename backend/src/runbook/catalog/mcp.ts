import {
  callTool,
  listTools,
  type McpTarget,
  resultText,
  toolHash,
  withMcpClient,
} from '../../integrations/mcp/mcp-client';
import { type CatalogNode, fail, MAIN, ok, StepInputError, type StepTools } from './define';

// Tool output lands in later steps' templates and in prompts; cap it so a
// chatty server cannot bloat the run record.
const MAX_TEXT = 100_000;

async function target(t: StepTools): Promise<McpTarget> {
  const hasCredential = String(t.config.credential ?? '').trim() !== '';
  const cred = hasCredential ? await t.credential('credential') : null;
  const url = t.str('url') || (typeof cred?.metadata.url === 'string' ? cred.metadata.url : '');
  if (!url) {
    throw new StepInputError('Set the server URL or pick an MCP server credential that has one');
  }
  return { url, token: cred?.secret };
}

export const MCP_NODES: CatalogNode[] = [
  {
    type: 'mcp.callTool',
    category: 'ai',
    icon: 'Plug',
    color: 'bg-fuchsia-700',
    label: { en: 'MCP tool', es: 'Herramienta MCP' },
    description: {
      en: 'Call a tool on an MCP server (Streamable HTTP). Pin it to the reviewed definition so a changed tool fails the step instead of running.',
      es: 'Llama una herramienta de un servidor MCP (Streamable HTTP). Fijala a la definición revisada para que, si la herramienta cambia, el paso falle en vez de ejecutarse.',
    },
    inputs: MAIN,
    outputs: MAIN,
    properties: [
      {
        name: 'credential',
        displayName: 'MCP server',
        type: 'secret',
        description: 'Credential with the server URL and its bearer token',
        typeOptions: { provider: 'mcp' },
      },
      {
        name: 'url',
        displayName: 'Server URL',
        type: 'string',
        description: 'Overrides the credential URL; enough on its own for servers without auth',
      },
      { name: 'tool', displayName: 'Tool', type: 'string', required: true },
      {
        name: 'arguments',
        displayName: 'Arguments (JSON)',
        type: 'string',
        default: '{}',
        typeOptions: { rows: 6, expression: true },
      },
      {
        name: 'toolHash',
        displayName: 'Pinned definition',
        type: 'string',
        description: 'Filled by the MCP tester. When set, the step fails if the tool changed.',
      },
      {
        name: 'failOnToolError',
        displayName: 'Fail when the tool reports an error',
        type: 'boolean',
        default: true,
      },
      { name: 'timeoutSeconds', displayName: 'Timeout (seconds)', type: 'number', default: 60 },
    ],
    run: async t => {
      const startTime = Date.now();
      const name = t.str('tool');
      const args = t.json<Record<string, unknown>>('arguments', {});
      if (!args || typeof args !== 'object' || Array.isArray(args)) {
        return fail('arguments must be a JSON object', startTime);
      }
      const pinned = t.str('toolHash');
      const server = await target(t);

      // Tool annotations are the server's own claims, so even a
      // "read-only" tool is not called on a dry run.
      if (t.context.dryRun) {
        t.context.emit?.({
          type: 'log',
          text: `[dry-run] would call MCP tool ${name} on ${new URL(server.url).host}`,
          timestamp: new Date(),
        });
        return ok({ dryRun: true, tool: name, arguments: args }, startTime);
      }

      const timeoutMs = Math.min(Math.max(t.num('timeoutSeconds'), 1), 600) * 1000;
      return withMcpClient(
        server,
        async client => {
          if (pinned) {
            const tool = (await listTools(client, timeoutMs)).find(x => x.name === name);
            if (!tool) return fail(`MCP tool ${name} no longer exists on the server`, startTime);
            const current = toolHash(tool);
            if (current !== pinned) {
              return fail(
                `MCP tool ${name} changed since it was reviewed (pinned ${pinned}, now ${current}); re-check it in the MCP tester`,
                startTime
              );
            }
          }
          t.context.emit?.({ type: 'log', text: `MCP ${name}`, timestamp: new Date() });
          const result = await callTool(client, name, args, timeoutMs);
          const text = resultText(result);
          const output = {
            tool: name,
            isError: result.isError === true,
            text: text.length > MAX_TEXT ? `${text.slice(0, MAX_TEXT)}…` : text,
            structured: result.structuredContent ?? null,
          };
          if (result.isError && t.bool('failOnToolError')) {
            return { ...fail(`MCP tool ${name}: ${text.slice(0, 500)}`, startTime), output };
          }
          return ok(output, startTime);
        },
        { timeoutMs, httpFetch: t.fetch }
      );
    },
  },
];
