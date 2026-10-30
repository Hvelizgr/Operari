const sessionsCreate = jest.fn();
const eventsSend = jest.fn();
const eventsStream = jest.fn();
jest.mock('@anthropic-ai/sdk', () => {
  const Anthropic = jest.fn().mockImplementation(() => ({
    beta: {
      sessions: { create: sessionsCreate, events: { send: eventsSend, stream: eventsStream } },
    },
  }));
  Object.assign(Anthropic, { APIError: class extends Error {} });
  return { __esModule: true, default: Anthropic };
});

import { BUILTIN_CATALOG, CatalogExecutor } from '../../../runbook/catalog';
import type { CatalogDeps } from '../../../runbook/catalog/define';
import type { ExecutorContext } from '../../../runbook/types/executor.types';

const byType = (type: string) => BUILTIN_CATALOG.find(n => n.type === type)!;
const ctx = (): ExecutorContext => ({
  runId: 'run-1',
  stepId: 'step-1',
  variables: {},
  previousOutputs: {},
  tenantId: 't-1',
  secrets: { acc1: 'sk-ant', gh: 'ghp' },
});
const deps = (provider: string, shell?: { execute: jest.Mock }): CatalogDeps => ({
  findAccount: async () => ({ provider, metadata: {} }),
  ...(shell ? { shell: { type: 'shell', ...shell } as unknown as CatalogDeps['shell'] } : {}),
});

async function* events(list: unknown[]) {
  for (const e of list) yield e;
}

describe('agent.managedSession', () => {
  beforeEach(() => {
    sessionsCreate.mockReset().mockResolvedValue({ id: 'sesn_1' });
    eventsSend.mockReset().mockResolvedValue({});
    eventsStream.mockReset();
  });

  it('streams first, denies paused tool calls and returns the agent text', async () => {
    eventsStream.mockResolvedValue(
      events([
        { type: 'agent.message', content: [{ type: 'text', text: 'Fixed the flaky test.' }] },
        { type: 'agent.tool_use', id: 'tu1', evaluated_permission: 'ask' },
        { type: 'session.status_idle', stop_reason: { type: 'requires_action' } },
        { type: 'session.status_idle', stop_reason: { type: 'end_turn' } },
      ])
    );
    const res = await new CatalogExecutor(
      byType('agent.managedSession'),
      fetch,
      deps('ai.anthropic')
    ).execute(
      {
        provider: '{{secrets.acc1}}',
        agentId: 'agent_1',
        environmentId: 'env_1',
        task: 'fix CI',
        repoUrl: 'https://github.com/acme/api',
        githubToken: '{{secrets.gh}}',
      },
      ctx()
    );
    expect(res.output).toMatchObject({
      sessionId: 'sesn_1',
      result: 'Fixed the flaky test.',
      deniedToolCalls: 1,
    });
    expect(eventsStream.mock.invocationCallOrder[0]).toBeLessThan(
      eventsSend.mock.invocationCallOrder[0]
    );
    expect(sessionsCreate.mock.calls[0][0]).toMatchObject({
      agent: 'agent_1',
      environment_id: 'env_1',
      resources: [
        {
          type: 'github_repository',
          url: 'https://github.com/acme/api',
          authorization_token: 'ghp',
        },
      ],
    });
    expect(eventsSend).toHaveBeenCalledWith('sesn_1', {
      events: [{ type: 'user.tool_confirmation', tool_use_id: 'tu1', result: 'deny' }],
    });
  });

  it('kicks off with an outcome and rubric when asked', async () => {
    eventsStream.mockResolvedValue(
      events([{ type: 'session.status_idle', stop_reason: { type: 'end_turn' } }])
    );
    await new CatalogExecutor(byType('agent.managedSession'), fetch, deps('ai.anthropic')).execute(
      {
        provider: '{{secrets.acc1}}',
        agentId: 'a',
        environmentId: 'e',
        task: 'write report',
        mode: 'outcome',
        rubric: '- has a table',
      },
      ctx()
    );
    expect(eventsSend.mock.calls[0][1].events[0]).toMatchObject({
      type: 'user.define_outcome',
      rubric: { type: 'text', content: '- has a table' },
    });
  });

  it('fails when the session is terminated', async () => {
    eventsStream.mockResolvedValue(events([{ type: 'session.status_terminated' }]));
    const res = await new CatalogExecutor(
      byType('agent.managedSession'),
      fetch,
      deps('ai.anthropic')
    ).execute({ provider: '{{secrets.acc1}}', agentId: 'a', environmentId: 'e', task: 'x' }, ctx());
    expect(res.success).toBe(false);
  });

  it('rejects a non-Anthropic provider', async () => {
    const res = await new CatalogExecutor(
      byType('agent.managedSession'),
      fetch,
      deps('ai.openai')
    ).execute({ provider: '{{secrets.acc1}}', agentId: 'a', environmentId: 'e', task: 'x' }, ctx());
    expect(res.success).toBe(false);
    expect(sessionsCreate).not.toHaveBeenCalled();
  });
});

describe('agent.cliSession', () => {
  it('runs Claude Code through the shell step with the task and key in env, not the command', async () => {
    const shell = {
      execute: jest.fn(async () => ({
        success: true,
        output: {
          stdout:
            'cloning…\n{"type":"result","result":"done","session_id":"s1","total_cost_usd":0.4,"is_error":false}',
        },
      })),
    };
    const res = await new CatalogExecutor(
      byType('agent.cliSession'),
      fetch,
      deps('ai.anthropic', shell)
    ).execute(
      {
        provider: '{{secrets.acc1}}',
        task: 'rm -rf / ; echo "$(whoami)"',
        repoUrl: 'https://github.com/acme/api',
      },
      ctx()
    );
    expect(res.output).toMatchObject({
      agent: 'claude-code',
      result: 'done',
      sessionId: 's1',
      costUsd: 0.4,
    });
    const [config] = shell.execute.mock.calls[0] as unknown as [
      { command: string; env: Record<string, string> },
    ];
    expect(config.command).not.toContain('rm -rf');
    expect(config.command).not.toContain('sk-ant');
    expect(config.command).toContain('--permission-mode acceptEdits');
    expect(config.env).toMatchObject({
      OPERARI_TASK: 'rm -rf / ; echo "$(whoami)"',
      ANTHROPIC_API_KEY: 'sk-ant',
    });
  });

  it('reads the final Codex message after the marker', async () => {
    const shell = {
      execute: jest.fn(async () => ({
        success: true,
        output: { stdout: '----operari-codex-final----\nAll green' },
      })),
    };
    const res = await new CatalogExecutor(
      byType('agent.cliSession'),
      fetch,
      deps('ai.openai', shell)
    ).execute({ provider: '{{secrets.acc1}}', agent: 'codex', task: 't' }, ctx());
    expect(res.output).toMatchObject({ agent: 'codex', result: 'All green' });
    const [config] = shell.execute.mock.calls[0] as unknown as [{ command: string }];
    expect(config.command).toContain('--sandbox workspace-write');
  });

  it('refuses a provider that does not match the agent', async () => {
    const shell = { execute: jest.fn() };
    const res = await new CatalogExecutor(
      byType('agent.cliSession'),
      fetch,
      deps('ai.openai', shell)
    ).execute({ provider: '{{secrets.acc1}}', task: 't' }, ctx());
    expect(res.success).toBe(false);
    expect(shell.execute).not.toHaveBeenCalled();
  });
});
