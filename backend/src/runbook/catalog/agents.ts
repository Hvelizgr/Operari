import Anthropic from '@anthropic-ai/sdk';

import { type CatalogNode, fail, MAIN, ok, StepInputError, type StepTools } from './define';

const meta = (
  type: string,
  icon: string,
  label: [string, string],
  description: [string, string]
) => ({
  type,
  category: 'ai',
  icon,
  color: 'bg-fuchsia-700',
  label: { en: label[0], es: label[1] },
  description: { en: description[0], es: description[1] },
  inputs: MAIN,
  outputs: MAIN,
});

const task = {
  name: 'task',
  displayName: 'Task',
  type: 'string' as const,
  required: true,
  description: 'What the agent should do, with the context it needs. Templates allowed.',
  typeOptions: { rows: 6, expression: true },
};

async function anthropicCredential(t: StepTools) {
  const cred = await t.credential('provider');
  if (cred.provider !== 'ai.anthropic') {
    throw new StepInputError('Managed Agents needs an Anthropic provider credential');
  }
  return cred;
}

/**
 * Delegates a task to a Claude Managed Agents session: Anthropic runs the
 * agent loop and an isolated sandbox, Operari only starts it, follows its
 * events and reports the result. The agent and environment are created
 * once outside Operari (Console or `ant apply`) and referenced by id.
 */
const managedSession: CatalogNode = {
  ...meta(
    'agent.managedSession',
    'Bot',
    ['Agent session (Claude)', 'Sesión de agente (Claude)'],
    [
      'Hand a task to a Claude Managed Agent running in its own sandbox and wait for the result',
      'Delegar una tarea a un Claude Managed Agent en su propio sandbox y esperar el resultado',
    ]
  ),
  properties: [
    {
      name: 'provider',
      displayName: 'Anthropic provider',
      type: 'secret',
      required: true,
      typeOptions: { provider: 'ai.anthropic' },
    },
    {
      name: 'agentId',
      displayName: 'Agent id',
      type: 'string',
      required: true,
      description: 'agent_… (create it in the Console or with ant apply)',
    },
    {
      name: 'environmentId',
      displayName: 'Environment id',
      type: 'string',
      required: true,
      description: 'env_…',
    },
    task,
    {
      name: 'mode',
      displayName: 'Kickoff',
      type: 'options',
      default: 'message',
      options: [
        { name: 'Message (answer / do the task)', value: 'message' },
        { name: 'Outcome (iterate until a rubric passes)', value: 'outcome' },
      ],
    },
    {
      name: 'rubric',
      displayName: 'Rubric',
      type: 'string',
      required: true,
      description: 'Checkable criteria, one per line.',
      typeOptions: { rows: 5, expression: true },
      displayOptions: { show: { mode: ['outcome'] } },
    },
    {
      name: 'repoUrl',
      displayName: 'GitHub repository',
      type: 'string',
      description: 'Mounted at /workspace/repo. Optional.',
    },
    { name: 'branch', displayName: 'Branch', type: 'string', default: 'main' },
    {
      name: 'githubToken',
      displayName: 'GitHub token',
      type: 'secret',
      description: 'Needed for private repositories.',
    },
    { name: 'timeoutMinutes', displayName: 'Timeout (minutes)', type: 'number', default: 30 },
  ],
  run: async t => {
    const cred = await anthropicCredential(t);
    if (t.context.dryRun) return ok({ dryRun: true, agentId: t.str('agentId') });

    const client = new Anthropic({ apiKey: cred.secret });
    const repoUrl = t.str('repoUrl');
    const session = await client.beta.sessions.create({
      agent: t.str('agentId'),
      environment_id: t.str('environmentId'),
      title: `Operari run ${t.context.runId} · ${t.context.stepId}`,
      ...(repoUrl
        ? {
            resources: [
              {
                type: 'github_repository' as const,
                url: repoUrl,
                mount_path: '/workspace/repo',
                ...(t.str('githubToken') ? { authorization_token: t.str('githubToken') } : {}),
                checkout: { type: 'branch' as const, name: t.str('branch') || 'main' },
              },
            ],
          }
        : {}),
    });
    const traceUrl = `https://platform.claude.com/workspaces/default/sessions/${session.id}`;
    t.context.emit?.({
      type: 'log',
      text: `managed agent session ${session.id} — ${traceUrl}`,
      timestamp: new Date(),
    });

    const messages: string[] = [];
    let denied = 0;
    let status = 'running';
    let error: string | null = null;
    const deadline = Date.now() + Math.max(1, t.num('timeoutMinutes')) * 60_000;
    let timedOut = false;

    // Stream first, then send: the stream only carries events after it opens.
    const stream = await client.beta.sessions.events.stream(session.id);
    const kickoff =
      t.str('mode') === 'outcome'
        ? {
            type: 'user.define_outcome' as const,
            description: t.str('task'),
            rubric: { type: 'text' as const, content: t.str('rubric') },
          }
        : {
            type: 'user.message' as const,
            content: [{ type: 'text' as const, text: t.str('task') }],
          };
    await client.beta.sessions.events.send(session.id, { events: [kickoff] });

    const timer = setTimeout(
      () => {
        timedOut = true;
        void client.beta.sessions.events
          .send(session.id, { events: [{ type: 'user.interrupt' }] })
          .catch(() => undefined);
      },
      Math.max(0, deadline - Date.now())
    );
    try {
      loop: for await (const event of stream) {
        switch (event.type) {
          case 'agent.message':
            for (const block of event.content) {
              if (block.type === 'text') {
                messages.push(block.text);
                t.context.emit?.({ type: 'stdout', text: block.text, timestamp: new Date() });
              }
            }
            break;
          case 'agent.tool_use':
          case 'agent.mcp_tool_use':
            // Nobody is watching an automated run: never approve a paused call.
            if (event.evaluated_permission === 'ask') {
              denied++;
              await client.beta.sessions.events.send(session.id, {
                events: [{ type: 'user.tool_confirmation', tool_use_id: event.id, result: 'deny' }],
              });
            }
            break;
          case 'agent.custom_tool_use':
            await client.beta.sessions.events.send(session.id, {
              events: [
                {
                  type: 'user.custom_tool_result',
                  custom_tool_use_id: event.id,
                  content: [
                    {
                      type: 'text',
                      text: `Tool "${event.name}" is not available in this Operari run.`,
                    },
                  ],
                },
              ],
            });
            break;
          case 'session.error':
            error = JSON.stringify((event as { error?: unknown }).error ?? event).slice(0, 500);
            break;
          case 'session.status_idle':
            if (event.stop_reason.type === 'requires_action') break;
            status = event.stop_reason.type;
            break loop;
          case 'session.status_terminated':
            status = 'terminated';
            break loop;
        }
      }
    } finally {
      clearTimeout(timer);
    }

    const output = {
      sessionId: session.id,
      traceUrl,
      status: timedOut ? 'timed_out' : status,
      result: messages.join('\n').trim(),
      deniedToolCalls: denied,
    };
    if (timedOut)
      return fail(
        `agent session ${session.id} hit the ${t.num('timeoutMinutes')} min timeout — see ${traceUrl}`
      );
    if (status === 'terminated' || error) {
      return fail(
        `agent session ${session.id} ${error ? `failed: ${error}` : 'was terminated'} — see ${traceUrl}`
      );
    }
    return ok(output);
  },
};

const AGENT_CLIS = {
  'claude-code': {
    env: 'ANTHROPIC_API_KEY',
    provider: 'ai.anthropic',
    // `claude` from the image when present, else a one-off npx install.
    command: (mode: string) =>
      `CLAUDE=$(command -v claude || echo "npx -y @anthropic-ai/claude-code"); $CLAUDE -p "$OPERARI_TASK" --output-format json --permission-mode ${mode} < /dev/null`,
  },
  codex: {
    env: 'OPENAI_API_KEY',
    provider: 'ai.openai',
    command: (mode: string) =>
      `CODEX=$(command -v codex || echo "npx -y @openai/codex"); $CODEX exec --sandbox ${mode} -o "$TMPDIR/codex-last.txt" "$OPERARI_TASK" < /dev/null >&2 && echo "${CODEX_MARKER}" && cat "$TMPDIR/codex-last.txt"`,
  },
} as const;
const CODEX_MARKER = '----operari-codex-final----';

/**
 * Runs a coding agent CLI headless through the `shell` step, so it inherits
 * the configured runner (an isolated container with the docker runner)
 * and the local-runner tenant allowlist.
 */
const cliSession: CatalogNode = {
  ...meta(
    'agent.cliSession',
    'TerminalSquare',
    ['Coding agent (CLI)', 'Agente de código (CLI)'],
    [
      'Run Claude Code or Codex headless on a repository in the runner and capture its answer',
      'Ejecutar Claude Code o Codex sin interfaz sobre un repositorio en el runner y capturar su respuesta',
    ]
  ),
  properties: [
    {
      name: 'agent',
      displayName: 'Agent',
      type: 'options',
      default: 'claude-code',
      options: [
        { name: 'Claude Code', value: 'claude-code' },
        { name: 'Codex', value: 'codex' },
      ],
    },
    {
      name: 'provider',
      displayName: 'AI provider (API key)',
      type: 'secret',
      required: true,
      description: 'Anthropic for Claude Code, OpenAI for Codex.',
      typeOptions: { provider: 'ai' },
    },
    task,
    {
      name: 'claudePermissions',
      displayName: 'Permissions',
      type: 'options',
      default: 'acceptEdits',
      options: [
        { name: 'Read only (plan)', value: 'plan' },
        { name: 'Edit files', value: 'acceptEdits' },
        { name: 'Everything, no prompts (isolated runner only)', value: 'bypassPermissions' },
      ],
      displayOptions: { show: { agent: ['claude-code'] } },
    },
    {
      name: 'codexSandbox',
      displayName: 'Sandbox',
      type: 'options',
      default: 'workspace-write',
      options: [
        { name: 'Read only', value: 'read-only' },
        { name: 'Edit the workspace', value: 'workspace-write' },
        { name: 'Full access (isolated runner only)', value: 'danger-full-access' },
      ],
      displayOptions: { show: { agent: ['codex'] } },
    },
    {
      name: 'repoUrl',
      displayName: 'Repository (https)',
      type: 'string',
      description: 'Cloned before the agent starts. Optional.',
    },
    { name: 'branch', displayName: 'Branch', type: 'string', default: 'main' },
    {
      name: 'gitToken',
      displayName: 'Git token',
      type: 'secret',
      description: 'For private repositories.',
    },
    {
      name: 'image',
      displayName: 'Runner image',
      type: 'string',
      description: 'docker / fly runners: an image with git and Node (or the agent CLI).',
    },
    { name: 'timeoutMinutes', displayName: 'Timeout (minutes)', type: 'number', default: 30 },
  ],
  run: async t => {
    const shell = t.shell;
    if (!shell) return fail('agent.cliSession: the shell executor is not available');
    const agent = t.str('agent') === 'codex' ? 'codex' : 'claude-code';
    const spec = AGENT_CLIS[agent];
    const cred = await t.credential('provider');
    if (cred.provider !== spec.provider) {
      throw new StepInputError(
        `${agent} needs a ${spec.provider} credential, not ${cred.provider}`
      );
    }

    const repoUrl = t.str('repoUrl');
    if (repoUrl && !/^https:\/\//.test(repoUrl))
      throw new StepInputError('repoUrl must be an https:// URL');
    const clone = repoUrl
      ? `REPO="$OPERARI_REPO"; if [ -n "$OPERARI_GIT_TOKEN" ]; then REPO="https://x-access-token:$OPERARI_GIT_TOKEN@\${OPERARI_REPO#https://}"; fi; git clone --depth 1 --branch "$OPERARI_BRANCH" "$REPO" work >&2 && cd work && `
      : '';
    const mode = agent === 'codex' ? t.str('codexSandbox') : t.str('claudePermissions');
    const result = await shell.execute(
      {
        command: `set -e; ${clone}${spec.command(mode)}`,
        timeout: Math.max(1, t.num('timeoutMinutes')) * 60_000,
        env: {
          OPERARI_TASK: t.str('task'),
          OPERARI_REPO: repoUrl,
          OPERARI_BRANCH: t.str('branch') || 'main',
          OPERARI_GIT_TOKEN: t.str('gitToken'),
          [spec.env]: cred.secret,
        },
        ...(t.str('image') ? { image: t.str('image') } : {}),
      },
      t.context
    );
    const out = (result.output ?? {}) as { stdout?: string; exitCode?: number | null };
    const stdout = out.stdout ?? '';
    if (!result.success) return fail(`${agent}: ${result.error ?? 'failed'}`);

    if (agent === 'codex') {
      const i = stdout.lastIndexOf(CODEX_MARKER);
      return ok({
        agent,
        result: (i >= 0 ? stdout.slice(i + CODEX_MARKER.length) : stdout).trim(),
        exitCode: out.exitCode ?? 0,
      });
    }
    const last = stdout.trim().split('\n').pop() ?? '';
    try {
      const parsed = JSON.parse(last) as {
        result?: string;
        is_error?: boolean;
        session_id?: string;
        total_cost_usd?: number;
        num_turns?: number;
      };
      if (parsed.is_error) return fail(`claude-code: ${parsed.result ?? 'reported an error'}`);
      return ok({
        agent,
        result: parsed.result ?? '',
        sessionId: parsed.session_id ?? null,
        costUsd: parsed.total_cost_usd ?? null,
        turns: parsed.num_turns ?? null,
      });
    } catch {
      return ok({ agent, result: stdout.trim(), exitCode: out.exitCode ?? 0 });
    }
  },
};

export const AGENT_NODES: CatalogNode[] = [managedSession, cliSession];
