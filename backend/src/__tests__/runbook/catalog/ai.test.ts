const create = jest.fn();
jest.mock('@anthropic-ai/sdk', () => {
  class APIError extends Error {
    status?: number;
  }
  const Anthropic = jest.fn().mockImplementation(() => ({ beta: { messages: { create } } }));
  Object.assign(Anthropic, { APIError });
  return { __esModule: true, default: Anthropic };
});

import { BUILTIN_CATALOG, CatalogExecutor } from '../../../runbook/catalog';
import type { ExecutorContext } from '../../../runbook/types/executor.types';

const node = BUILTIN_CATALOG.find(n => n.type === 'ai.prompt')!;

const ctx = (over: Partial<ExecutorContext> = {}): ExecutorContext => ({
  runId: 'run-1',
  stepId: 'step-1',
  variables: {},
  previousOutputs: {},
  tenantId: 't-1',
  secrets: { acc1: 'sk-test' },
  ...over,
});

const account = (provider: string, metadata: Record<string, unknown> = {}) => ({
  findAccount: jest.fn(async (id: string, tenantId: string) =>
    id === 'acc1' && tenantId === 't-1' ? { provider, metadata } : null
  ),
});

describe('ai.prompt', () => {
  beforeEach(() => create.mockReset());

  it('calls Claude through the SDK with server-side fallbacks on current models', async () => {
    create.mockResolvedValue({
      stop_reason: 'end_turn',
      content: [{ type: 'text', text: '{"severity": "high"}' }],
      model: 'claude-opus-5-5',
      usage: { input_tokens: 10, output_tokens: 5 },
    });
    const res = await new CatalogExecutor(node, fetch, account('ai.anthropic')).execute(
      { provider: '{{secrets.acc1}}', prompt: 'classify', output: 'json', effort: 'low' },
      ctx()
    );
    expect(res.output).toMatchObject({ json: { severity: 'high' }, model: 'claude-opus-5-5' });
    const body = create.mock.calls[0][0];
    expect(body).toMatchObject({
      model: 'claude-opus-5-5',
      max_tokens: 16000,
      fallbacks: 'default',
      betas: ['server-side-fallback-2026-07-01'],
      output_config: { effort: 'low' },
    });
    expect(body).not.toHaveProperty('temperature');
  });

  it('fails cleanly when Claude declines', async () => {
    create.mockResolvedValue({
      stop_reason: 'refusal',
      stop_details: { category: 'cyber' },
      content: [],
      model: 'claude-opus-5-5',
      usage: {},
    });
    const res = await new CatalogExecutor(node, fetch, account('ai.anthropic')).execute(
      { provider: '{{secrets.acc1}}', prompt: 'x' },
      ctx()
    );
    expect(res.success).toBe(false);
    expect(res.error).toContain('cyber');
  });

  it('uses Chat Completions for an OpenAI-compatible provider', async () => {
    const fetchMock = jest.fn(
      async () =>
        new Response(
          JSON.stringify({
            choices: [{ message: { content: 'ok' } }],
            usage: { prompt_tokens: 3, completion_tokens: 1 },
            model: 'llama3',
          }),
          { status: 200 }
        )
    );
    const res = await new CatalogExecutor(
      node,
      fetchMock as never,
      account('ai.openai-compatible', {
        baseUrl: 'https://llm.example.com/v1/',
        defaultModel: 'llama3',
      })
    ).execute({ provider: '{{secrets.acc1}}', prompt: 'hi', system: 'be brief' }, ctx());
    expect(res.output).toMatchObject({ text: 'ok', usage: { inputTokens: 3, outputTokens: 1 } });
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('https://llm.example.com/v1/chat/completions');
    expect((init.headers as Record<string, string>).Authorization).toBe('Bearer sk-test');
    expect(JSON.parse(init.body as string)).toMatchObject({
      model: 'llama3',
      max_tokens: 16000,
      messages: [
        { role: 'system', content: 'be brief' },
        { role: 'user', content: 'hi' },
      ],
    });
  });

  it('refuses a credential from another workspace', async () => {
    const res = await new CatalogExecutor(node, fetch, account('ai.anthropic')).execute(
      { provider: '{{secrets.acc1}}', prompt: 'x' },
      ctx({ tenantId: 'other' })
    );
    expect(res.success).toBe(false);
    expect(create).not.toHaveBeenCalled();
  });

  it('rejects a non-AI credential', async () => {
    const res = await new CatalogExecutor(node, fetch, account('slack')).execute(
      { provider: '{{secrets.acc1}}', prompt: 'x' },
      ctx()
    );
    expect(res.error).toMatch(/not an AI provider/);
  });
});
