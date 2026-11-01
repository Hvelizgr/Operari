import {
  CatalogExecutor,
  type CatalogNode,
  isVisible,
  SERVICE_NODES,
} from '../../../runbook/catalog';
import type { ExecutorContext } from '../../../runbook/types/executor.types';

const ctx = (): ExecutorContext => ({
  runId: 'run-1',
  stepId: 'step-1',
  variables: {},
  previousOutputs: {},
  tenantId: 't-1',
});

const TOKEN = 'tok_test:secret123';
const URL_FIELD = /(url|host|homeserver)$/i;

/** A plausible value for every field the chosen operation shows. */
function fill(node: CatalogNode, operation: string): Record<string, unknown> {
  const config: Record<string, unknown> = { operation };
  for (const p of node.properties) {
    if (p.name === 'operation' || p.name === 'additionalFields') continue;
    if (!isVisible(p, config)) continue;
    if (p.type === 'secret') config[p.name] = TOKEN;
    else if (p.type === 'number') config[p.name] = 1;
    else if (p.type === 'boolean') config[p.name] = true;
    else if (p.type === 'options') config[p.name] = p.default ?? p.options![0].value;
    else if (URL_FIELD.test(p.name)) config[p.name] = 'https://example.test';
    else if (/JSON array/i.test(p.displayName)) config[p.name] = '[{"a": 1}]';
    else if (/JSON/i.test(p.displayName)) config[p.name] = '{"a": 1}';
    else config[p.name] = `${p.name}-1`;
  }
  return config;
}

const cases = SERVICE_NODES.flatMap(node => {
  const op = node.properties.find(p => p.name === 'operation')!;
  return op.options!.map(o => [`${node.type} · ${o.value}`, node, o.value] as const);
});

describe('service integrations', () => {
  it('cover a broad catalog', () => {
    expect(SERVICE_NODES.length).toBeGreaterThan(20);
    expect(cases.length).toBeGreaterThan(150);
  });

  it.each(cases)('%s builds an authenticated https request', async (_name, node, operation) => {
    const calls: Array<{ url: string; init: RequestInit }> = [];
    const fetchMock = (async (url: string, init: RequestInit) => {
      calls.push({ url, init });
      return new Response('{"ok": true}', {
        status: 200,
        headers: { 'content-type': 'application/json' },
      });
    }) as unknown as typeof fetch;

    const res = await new CatalogExecutor(node, fetchMock).execute(fill(node, operation), ctx());

    expect(res.error).toBeUndefined();
    expect(res.success).toBe(true);
    expect(calls).toHaveLength(1);
    const { url, init } = calls[0];
    expect(url).toMatch(/^https:\/\//);
    expect(new URL(url).pathname).not.toMatch(/[{}]/);
    const headers = JSON.stringify(init.headers ?? {});
    const body = typeof init.body === 'string' ? decodeURIComponent(init.body) : '';
    const auth = headers + decodeURIComponent(url) + body;
    const basicHeader = /Basic ([A-Za-z0-9+/=]+)/.exec(headers)?.[1];
    const basicDecoded = basicHeader ? Buffer.from(basicHeader, 'base64').toString() : '';
    const needsCredential = node.properties.some(p => p.name === 'credential');
    if (needsCredential) expect(auth.includes(TOKEN) || basicDecoded.includes(TOKEN)).toBe(true);
    if (init.body !== undefined && typeof init.body === 'string' && init.body.startsWith('{')) {
      expect(() => JSON.parse(init.body as string)).not.toThrow();
    }
  });
});
