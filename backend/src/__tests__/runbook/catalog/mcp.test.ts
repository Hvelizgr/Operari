import { toolHash } from '../../../integrations/mcp/mcp-client';
import { BUILTIN_CATALOG, CatalogExecutor } from '../../../runbook/catalog';
import type { ExecutorContext } from '../../../runbook/types/executor.types';
import {
  BROKEN_TOOL,
  ECHO_TOOL,
  type FakeMcpServer,
  startFakeMcpServer,
} from '../../integrations/fake-mcp-server';

const ctx = (over: Partial<ExecutorContext> = {}): ExecutorContext => ({
  runId: 'run-1',
  stepId: 'step-1',
  variables: {},
  previousOutputs: {},
  tenantId: 't-1',
  ...over,
});

const node = BUILTIN_CATALOG.find(n => n.type === 'mcp.callTool')!;

describe('mcp.callTool', () => {
  let server: FakeMcpServer;
  let exec: CatalogExecutor;

  beforeAll(async () => {
    server = await startFakeMcpServer([ECHO_TOOL, BROKEN_TOOL]);
    exec = new CatalogExecutor(node, fetch, {
      findAccount: async id =>
        id === 'acc-1' ? { provider: 'mcp', metadata: { url: server.url } } : null,
    });
  });
  afterAll(() => server.close());

  it('calls the tool with templated arguments and passes its text on', async () => {
    const res = await exec.execute(
      { url: server.url, tool: 'echo', arguments: '{"message":"{{vars.host}}"}' },
      ctx({ variables: { host: 'db-1' } })
    );
    expect(res.success).toBe(true);
    expect(res.output).toMatchObject({ tool: 'echo', isError: false, text: 'echo: db-1' });
  });

  it('takes the URL and bearer token from an MCP credential', async () => {
    const res = await exec.execute(
      { credential: '{{secrets.acc-1}}', tool: 'echo', arguments: '{"message":"x"}' },
      ctx({ secrets: { 'acc-1': 'tok-123' } })
    );
    expect(res.success).toBe(true);
    expect(server.auth.at(-1)).toBe('Bearer tok-123');
  });

  it('runs when the pinned definition still matches', async () => {
    const res = await exec.execute(
      { url: server.url, tool: 'echo', arguments: '{}', toolHash: toolHash(ECHO_TOOL as never) },
      ctx()
    );
    expect(res.success).toBe(true);
  });

  it('refuses to call a tool whose definition changed since review', async () => {
    const calls = server.auth.length;
    const res = await exec.execute(
      { url: server.url, tool: 'echo', arguments: '{}', toolHash: '0000000000000000' },
      ctx()
    );
    expect(res.success).toBe(false);
    expect(res.error).toMatch(/changed since it was reviewed/);
    // Only the handshake and tools/list went out, no tools/call.
    expect(server.auth.length - calls).toBeLessThanOrEqual(4);
  });

  it('fails the step when the tool reports an error, unless told not to', async () => {
    const failed = await exec.execute({ url: server.url, tool: 'broken' }, ctx());
    expect(failed.success).toBe(false);
    expect(failed.error).toMatch(/disk full/);

    const tolerated = await exec.execute(
      { url: server.url, tool: 'broken', failOnToolError: false },
      ctx()
    );
    expect(tolerated.success).toBe(true);
    expect(tolerated.output).toMatchObject({ isError: true });
  });

  it('never contacts the server on a dry run', async () => {
    const calls = server.auth.length;
    const res = await exec.execute(
      { url: server.url, tool: 'echo', arguments: '{"message":"x"}' },
      ctx({ dryRun: true })
    );
    expect(res.success).toBe(true);
    expect(res.output).toMatchObject({ dryRun: true });
    expect(server.auth.length).toBe(calls);
  });

  it('needs a URL from the step or the credential', async () => {
    const res = await exec.execute({ tool: 'echo' }, ctx());
    expect(res.success).toBe(false);
    expect(res.error).toMatch(/server URL/);
  });
});
