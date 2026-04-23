import { ErrorCode, NodeExecutionError } from '../../errors/custom-error';
import type { ShellConfig } from '../../runbook/executors/shell.executor';
import type { ExecutorContext, StepExecutor } from '../../runbook/types/executor.types';
import type {
  ExecutionInput,
  ShellCommandNodeConfig,
  ShellCommandResult,
} from '../../types/workflow.types';
import type { EditorNodeExecutor, NodeErrorContext, NodeExecutorDeps } from './_shared';

/**
 * ShellCommand node — adapter that delegates to the runbook
 * `ShellExecutor` so the editor flow goes through the configured
 * `Runner` (local / docker / fly), enforcing `NANORUN_RUNNER`.
 *
 * This adapter exists because:
 *   1. The editor uses the node type "ShellCommand" while the runbook
 *      registry uses "shell" — different key namespaces.
 *   2. The runbook ShellExecutor expects an ExecutorContext with
 *      runId/stepId/tenantId/variables/previousOutputs, while editor
 *      executors take input + errorContext. We translate between the
 *      two shapes here so the dispatcher does not need a special case.
 *
 * Removing the original raw `child_process.exec()` path was the P0 RCE
 * fix; this file makes that wiring participate in the unified registry
 * built in step 5 of ADR 0002.
 *
 * The runbook executor is fetched via a getter so the editor's runbook
 * registry can be mutated (e.g. tests swapping the shell executor) and
 * the adapter still sees the latest entry.
 */
export class ShellCommandNodeExecutor implements EditorNodeExecutor<
  ShellCommandNodeConfig,
  ShellCommandResult
> {
  readonly type = 'ShellCommand';

  constructor(
    private readonly deps: Pick<NodeExecutorDeps, 'logger'>,
    private readonly getShellExecutor: () => StepExecutor | undefined
  ) {}

  async execute(
    config: ShellCommandNodeConfig,
    input: ExecutionInput,
    errorContext: NodeErrorContext,
    tenantId?: string,
    executionId?: string
  ): Promise<ShellCommandResult> {
    const { command } = config;
    if (!command) {
      throw new NodeExecutionError({
        ...errorContext,
        message: 'Shell command is not defined',
        userMessage: 'Shell command is empty',
        code: ErrorCode.NODE_EXECUTION_FAILED,
      });
    }

    const shellExecutor = this.getShellExecutor();
    if (!shellExecutor) {
      throw new NodeExecutionError({
        ...errorContext,
        message: 'Shell executor is not registered in the runbook registry',
        userMessage: 'Shell command execution is not available on this server',
        code: ErrorCode.NODE_EXECUTION_FAILED,
      });
    }

    const shellConfig: ShellConfig = { command };

    const context: ExecutorContext = {
      runId: executionId ?? 'editor-preview',
      stepId: errorContext.nodeId,
      variables: (input as Record<string, unknown>) ?? {},
      previousOutputs: (input as Record<string, unknown>) ?? {},
      // Prefer the real tenant from the dispatcher; only fall back
      // to 'default-tenant' on the editor preview path where the
      // executor is invoked WITHOUT going through ExecutionService
      // (e.g. test-run-this-step button in the editor).
      tenantId: tenantId ?? 'default-tenant',
    };

    const result = await shellExecutor.execute(shellConfig, context);

    if (!result.success) {
      const stderr = (result.output as { stderr?: string } | undefined)?.stderr ?? '';
      const execError = new NodeExecutionError({
        ...errorContext,
        message: `Shell command failed: ${result.error ?? 'unknown error'}`,
        userMessage: `Command failed: ${result.error ?? 'unknown error'}. Stderr: ${stderr}`,
        code: ErrorCode.NODE_EXECUTION_FAILED,
      });
      this.deps.logger.error('Shell command execution failed', {
        error: execError,
        metadata: { command, stderr },
      });
      throw execError;
    }

    const out = (result.output ?? {}) as { stdout?: string; stderr?: string };
    return { stdout: out.stdout ?? '', stderr: out.stderr ?? '' };
  }
}
