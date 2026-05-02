import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { Runner, RunnerSpec } from '../runners/runner.types';
import {
  ExecutorContext,
  ExecutorResult,
  resolveTemplate,
  StepExecutor,
} from '../types/executor.types';

export interface KubectlConfig {
  /** Subcommand and args after `kubectl`. e.g. "get pods --all-namespaces". */
  command: string;
  /** Optional namespace — appended as `--namespace=<ns>` when set. */
  namespace?: string;
  /** Optional kubectl context — appended as `--context=<ctx>` when set. */
  context?: string;
  /**
   * Connected-account id whose secret holds the kubeconfig YAML. The
   * engine pre-resolves `{{secrets.<id>}}` templates, so by the time
   * we see this field its value is the YAML body — not the secret id.
   * The executor materializes it to a tempfile per run, sets
   * KUBECONFIG, and unlinks the file in a finally block.
   */
  kubeconfigSecret?: string;
  /** Maximum execution time in milliseconds. Default 60s. */
  timeout?: number;
  /** Whether to fail the step on non-zero kubectl exit. Default true. */
  failOnNonZeroExit?: boolean;
}

export interface KubectlOutput {
  stdout: string;
  stderr: string;
  exitCode: number | null;
  command: string;
  namespace: string | null;
  context: string | null;
}

/**
 * `kubectl` executor — a thin wrapper over the runner that injects a
 * kubeconfig from a connected-account secret and prepends standard
 * flags (--namespace, --context). Exists as its own executor (rather
 * than a shell preset) so:
 *
 *   1. The kubeconfig YAML can land on disk through a controlled path
 *      with mode 0o600 + a per-run tempdir, then get unlinked in a
 *      `finally` block — leaving a copy of cluster credentials in
 *      `/tmp` would be a serious security regression.
 *   2. The blast-radius outline keys off `data-blast-radius="destructive"`
 *      from the catalog metadata, so SREs scanning a runbook see the
 *      red ring around every `kubectl` step at a glance — `kubectl set
 *      image`, `kubectl delete pod`, `kubectl apply -f -` all change
 *      cluster state in ways no rollback button can undo.
 *   3. Future kubectl-specific niceties (resource selectors, JSON
 *      output preset, dry-run-via-kubectl-flag instead of just our
 *      engine flag) live in one place.
 *
 * Dry-run mirrors the shell/http pattern: never spawn the runner,
 * never materialize kubeconfig, emit a `[dry-run] would run: ...`
 * log line, return a synthetic success.
 */
export class KubectlExecutor implements StepExecutor<KubectlConfig> {
  readonly type = 'kubectl';

  constructor(private readonly runner: Runner) {}

  async execute(config: KubectlConfig, context: ExecutorContext): Promise<ExecutorResult> {
    const command = resolveTemplate(config.command, context);
    const namespace = config.namespace ? resolveTemplate(config.namespace, context) : undefined;
    const ctxName = config.context ? resolveTemplate(config.context, context) : undefined;
    const failOnNonZero = config.failOnNonZeroExit ?? true;
    // The engine pre-resolves {{secrets.<id>}} before our config lands;
    // by this point the field carries the literal kubeconfig YAML.
    // Falling back to the raw value preserves behaviour when the user
    // pasted the YAML into the form for testing instead of wiring a
    // connected account.
    const kubeconfigYaml = config.kubeconfigSecret
      ? resolveTemplate(config.kubeconfigSecret, context)
      : undefined;

    const parts = ['kubectl'];
    if (namespace) parts.push(`--namespace=${namespace}`);
    if (ctxName) parts.push(`--context=${ctxName}`);
    parts.push(command);
    const fullCommand = parts.join(' ');

    if (context.dryRun) {
      context.emit?.({
        type: 'log',
        text: `[dry-run] would run: ${fullCommand}`,
        timestamp: new Date(),
      });
      return {
        success: true,
        output: {
          dryRun: true,
          command: fullCommand,
          namespace: namespace ?? null,
          context: ctxName ?? null,
          stdout: '',
          stderr: '',
          exitCode: 0,
        },
        duration: 0,
      };
    }

    let kubeconfigDir: string | undefined;
    let kubeconfigPath: string | undefined;
    try {
      if (kubeconfigYaml) {
        // Tempdir per run so two parallel kubectl steps in the same
        // run never trample each other's KUBECONFIG. Mode 0o600 on
        // the file means only the runner process can read it; the
        // dir defaults to 0o700 from mkdtemp.
        kubeconfigDir = await mkdtemp(join(tmpdir(), `op-kubectl-${context.runId}-`));
        kubeconfigPath = join(kubeconfigDir, 'kubeconfig');
        await writeFile(kubeconfigPath, kubeconfigYaml, { mode: 0o600 });
      }

      const env: Record<string, string> = {};
      if (kubeconfigPath) env.KUBECONFIG = kubeconfigPath;

      const spec: RunnerSpec = {
        command: fullCommand,
        timeoutMs: config.timeout ?? 60_000,
        env,
      };

      const result = await this.runner.run(spec, {
        runId: context.runId,
        stepId: context.stepId,
        tenantId: context.tenantId,
        emit: context.emit,
      });

      const output: KubectlOutput = {
        stdout: result.stdout,
        stderr: result.stderr,
        exitCode: result.exitCode,
        command: fullCommand,
        namespace: namespace ?? null,
        context: ctxName ?? null,
      };

      if (result.timedOut) {
        return {
          success: false,
          error: `kubectl timed out after ${spec.timeoutMs}ms`,
          output: output as unknown as Record<string, unknown>,
          duration: result.durationMs,
        };
      }

      const success = failOnNonZero ? result.exitCode === 0 : true;
      return {
        success,
        output: output as unknown as Record<string, unknown>,
        error: success ? undefined : `kubectl exited with code ${result.exitCode}`,
        duration: result.durationMs,
      };
    } finally {
      // Best-effort cleanup. A failed unlink leaves the kubeconfig in
      // /tmp until the next reboot — log-and-continue rather than
      // failing the run because of a transient FS error. The mode
      // 0o600 + per-run dir already minimizes the exposure window.
      if (kubeconfigDir) {
        await rm(kubeconfigDir, { recursive: true, force: true }).catch(() => undefined);
      }
    }
  }
}
