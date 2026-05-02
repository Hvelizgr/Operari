import { readFile, stat } from 'node:fs/promises';

import { KubectlExecutor } from '../../../runbook/executors/kubectl.executor';
import type {
  Runner,
  RunnerContext,
  RunnerResult,
  RunnerSpec,
} from '../../../runbook/runners/runner.types';
import type { ExecutorContext } from '../../../runbook/types/executor.types';

/**
 * Spy runner: captures the last spec + lets the test peek at the
 * KUBECONFIG path while the runner thinks it's executing. The peek
 * has to happen DURING run() because the executor unlinks the
 * kubeconfig in its finally block — once execute() resolves, the
 * file is gone.
 */
class SpyRunner implements Runner {
  readonly type = 'spy';
  public lastSpec?: RunnerSpec;
  public capturedKubeconfigContents: string | null = null;
  public capturedKubeconfigMode: number | null = null;

  constructor(private readonly fixture: RunnerResult) {}

  async run(spec: RunnerSpec, _context: RunnerContext): Promise<RunnerResult> {
    this.lastSpec = spec;
    if (spec.env?.KUBECONFIG) {
      try {
        this.capturedKubeconfigContents = await readFile(spec.env.KUBECONFIG, 'utf8');
        const s = await stat(spec.env.KUBECONFIG);
        this.capturedKubeconfigMode = s.mode & 0o777;
      } catch {
        this.capturedKubeconfigContents = null;
      }
    }
    return this.fixture;
  }
}

const execCtx = (
  overrides: Partial<ExecutorContext> & { _logs?: string[] } = {}
): ExecutorContext & { _logs: string[] } => {
  const _logs: string[] = [];
  return {
    runId: 'run-kc',
    stepId: 'step-1',
    tenantId: 'tenant-1',
    variables: {},
    previousOutputs: {},
    secrets: {},
    emit: event => _logs.push(event.text),
    ...overrides,
    _logs,
  };
};

describe('KubectlExecutor', () => {
  it('builds the full command with namespace and context flags', async () => {
    const runner = new SpyRunner({
      exitCode: 0,
      stdout: 'pod/api-1\npod/api-2',
      stderr: '',
      timedOut: false,
      durationMs: 42,
    });
    const executor = new KubectlExecutor(runner);

    const result = await executor.execute(
      { command: 'get pods', namespace: 'prod', context: 'us-east-1' },
      execCtx()
    );

    expect(runner.lastSpec?.command).toBe('kubectl --namespace=prod --context=us-east-1 get pods');
    expect(result.success).toBe(true);
    const output = result.output as { stdout: string; namespace: string; context: string };
    expect(output.stdout).toBe('pod/api-1\npod/api-2');
    expect(output.namespace).toBe('prod');
    expect(output.context).toBe('us-east-1');
  });

  it('omits flags when namespace and context are absent', async () => {
    const runner = new SpyRunner({
      exitCode: 0,
      stdout: '',
      stderr: '',
      timedOut: false,
      durationMs: 1,
    });
    const executor = new KubectlExecutor(runner);

    await executor.execute({ command: 'cluster-info' }, execCtx());

    expect(runner.lastSpec?.command).toBe('kubectl cluster-info');
  });

  it('materializes kubeconfig to a temp file with mode 0o600 and KUBECONFIG env', async () => {
    const runner = new SpyRunner({
      exitCode: 0,
      stdout: '',
      stderr: '',
      timedOut: false,
      durationMs: 1,
    });
    const executor = new KubectlExecutor(runner);
    const yaml = 'apiVersion: v1\nclusters:\n- name: prod\n';

    await executor.execute({ command: 'get nodes', kubeconfigSecret: yaml }, execCtx());

    expect(runner.lastSpec?.env?.KUBECONFIG).toBeDefined();
    expect(runner.capturedKubeconfigContents).toBe(yaml);
    expect(runner.capturedKubeconfigMode).toBe(0o600);
  });

  it('cleans up the kubeconfig tempdir after the runner returns', async () => {
    const runner = new SpyRunner({
      exitCode: 0,
      stdout: '',
      stderr: '',
      timedOut: false,
      durationMs: 1,
    });
    const executor = new KubectlExecutor(runner);

    await executor.execute({ command: 'get pods', kubeconfigSecret: 'apiVersion: v1' }, execCtx());

    const path = runner.lastSpec?.env?.KUBECONFIG as string;
    await expect(readFile(path)).rejects.toThrow();
  });

  it('cleans up the kubeconfig tempdir even when the runner throws', async () => {
    let capturedPath: string | undefined;
    const throwingRunner: Runner = {
      type: 'throwing',
      run: async (spec: RunnerSpec) => {
        capturedPath = spec.env?.KUBECONFIG;
        throw new Error('runner exploded');
      },
    };
    const executor = new KubectlExecutor(throwingRunner);

    await expect(
      executor.execute({ command: 'get pods', kubeconfigSecret: 'apiVersion: v1' }, execCtx())
    ).rejects.toThrow('runner exploded');

    expect(capturedPath).toBeDefined();
    await expect(readFile(capturedPath!)).rejects.toThrow();
  });

  it('dry-run never spawns the runner and returns synthetic success', async () => {
    const runner: Runner = {
      type: 'fake',
      run: jest.fn(async () => {
        throw new Error('runner must not be called in dry-run');
      }),
    };
    const executor = new KubectlExecutor(runner);
    const ctx = execCtx({ dryRun: true });

    const result = await executor.execute(
      {
        command: 'delete pod api-1',
        namespace: 'prod',
        kubeconfigSecret: 'apiVersion: v1',
      },
      ctx
    );

    expect(result.success).toBe(true);
    const output = result.output as { dryRun?: boolean; command?: string };
    expect(output.dryRun).toBe(true);
    expect(output.command).toBe('kubectl --namespace=prod delete pod api-1');
    expect(ctx._logs.some(l => l.startsWith('[dry-run] would run:'))).toBe(true);
    expect(runner.run).not.toHaveBeenCalled();
  });

  it('reports a non-zero exit as failed by default', async () => {
    const runner = new SpyRunner({
      exitCode: 1,
      stdout: '',
      stderr: 'forbidden: User cannot list pods',
      timedOut: false,
      durationMs: 8,
    });
    const executor = new KubectlExecutor(runner);

    const result = await executor.execute({ command: 'get pods' }, execCtx());

    expect(result.success).toBe(false);
    expect(result.error).toMatch(/exited with code 1/);
  });

  it('treats non-zero exit as success when failOnNonZeroExit is false', async () => {
    const runner = new SpyRunner({
      exitCode: 2,
      stdout: '',
      stderr: 'parse error',
      timedOut: false,
      durationMs: 4,
    });
    const executor = new KubectlExecutor(runner);

    const result = await executor.execute(
      { command: 'apply -f -', failOnNonZeroExit: false },
      execCtx()
    );

    expect(result.success).toBe(true);
  });

  it('reports timeout as failure with the configured limit', async () => {
    const runner = new SpyRunner({
      exitCode: null,
      stdout: '',
      stderr: '',
      timedOut: true,
      durationMs: 5000,
    });
    const executor = new KubectlExecutor(runner);

    const result = await executor.execute(
      { command: 'wait --for=condition=ready pod/api-1', timeout: 5000 },
      execCtx()
    );

    expect(result.success).toBe(false);
    expect(result.error).toMatch(/timed out after 5000ms/);
  });
});
