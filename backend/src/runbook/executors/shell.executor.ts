import path from 'path';

import { Runner, RunnerSpec } from '../runners/runner.types';
import {
  ExecutorContext,
  ExecutorResult,
  resolveTemplate,
  StepExecutor,
} from '../types/executor.types';

export interface ShellConfig {
  /** Shell command to execute. Supports {{vars.x}} template substitution. */
  command: string;
  /** Working directory for the command */
  cwd?: string;
  /** Additional environment variables (merged with process.env on LocalRunner) */
  env?: Record<string, string>;
  /** Maximum execution time in milliseconds (default: 60000) */
  timeout?: number;
  /** Shell to use (default: "sh") */
  shell?: string;
  /** Whether to fail the step on non-zero exit code (default: true) */
  failOnNonZeroExit?: boolean;
  /** Container image (used by Docker / Fly runners; ignored by LocalRunner) */
  image?: string;
}

export interface ShellOutput {
  stdout: string;
  stderr: string;
  exitCode: number | null;
  command: string;
}

/**
 * Shell command executor — the heart of Operari.
 *
 * Delegates actual execution to a {@link Runner}, which decides where the
 * command runs (host process, ephemeral container, Firecracker microVM, …).
 *
 * The executor itself is responsible for:
 *   - Template resolution ({{vars.x}}, {{steps.foo.output.bar}})
 *   - Mapping RunnerResult → ExecutorResult
 *   - Streaming output via context.emit (the Runner already does this)
 *
 * Choice of Runner is configured at startup via OPERARI_RUNNER (see
 * runners/index.ts). Default is LocalRunner for backwards compatibility
 * with existing self-host deployments.
 */
/**
 * The local runner executes on the backend host itself, where a step can
 * read every server secret (e.g. /proc/1/environ). On a deployment shared
 * by several tenants, OPERARI_LOCAL_SHELL_TENANTS limits it to trusted
 * tenants: a comma-separated list of tenant ids, or "none". Unset keeps
 * the single-tenant self-host behaviour of allowing everyone.
 */
export function localShellDenied(runner: Runner, tenantId: string): string | null {
  if (runner.type !== 'local') return null;
  const raw = process.env.OPERARI_LOCAL_SHELL_TENANTS?.trim();
  if (!raw) return null;
  const allowed = raw
    .split(',')
    .map(t => t.trim())
    .filter(t => t && t !== 'none');
  if (allowed.includes(tenantId)) return null;
  return (
    'Shell steps are disabled for this workspace on this server: the local runner has no ' +
    'isolation. Ask the operator to configure the docker or fly runner.'
  );
}

export class ShellExecutor implements StepExecutor<ShellConfig> {
  readonly type = 'shell';

  constructor(private readonly runner: Runner) {}

  /**
   * Validate that a working directory is within the allowed shell dir.
   * Returns the resolved cwd or throws if it escapes the allowed prefix.
   */
  private validateCwd(
    requestedCwd: string | undefined,
    allowedDir: string | undefined
  ): string | undefined {
    if (!allowedDir) return requestedCwd; // no restriction configured

    const resolved = requestedCwd ? path.resolve(allowedDir, requestedCwd) : allowedDir;

    // Ensure the resolved path starts with the allowed directory
    // (prevent ../../ traversal attacks)
    const normalizedAllowed = path.resolve(allowedDir) + path.sep;
    const normalizedResolved = path.resolve(resolved) + path.sep;
    if (
      !normalizedResolved.startsWith(normalizedAllowed) &&
      path.resolve(resolved) !== path.resolve(allowedDir)
    ) {
      throw new Error(
        `Shell sandbox violation: working directory "${requestedCwd}" ` +
          `escapes allowed directory "${allowedDir}". ` +
          `Resolved path: "${resolved}"`
      );
    }
    return resolved;
  }

  async execute(config: ShellConfig, context: ExecutorContext): Promise<ExecutorResult> {
    const denied = localShellDenied(this.runner, context.tenantId);
    if (denied) return { success: false, error: denied, duration: 0 };

    const command = resolveTemplate(config.command, context);
    const failOnNonZero = config.failOnNonZeroExit ?? true;

    // Shell sandbox: restrict cwd to the allowed directory when configured.
    // The allowed dir comes from the Project's allowedShellDir field (passed
    // via context.allowedShellDir) or the global OPERARI_SHELL_ALLOWED_DIR
    // env var. Project-level takes precedence.
    const allowedDir =
      (context as any).allowedShellDir ?? process.env.OPERARI_SHELL_ALLOWED_DIR ?? undefined;

    let safeCwd: string | undefined;
    try {
      safeCwd = this.validateCwd(config.cwd, allowedDir);
    } catch (err) {
      return {
        success: false,
        error: (err as Error).message,
        output: { command, stdout: '', stderr: (err as Error).message, exitCode: 1 },
        duration: 0,
      };
    }

    // Dry-run: never spawn a runner. Emit a log line so the run
    // timeline shows exactly what the real execution would send to
    // the shell, then return a success result shaped like a real
    // ShellOutput with `dryRun: true` so downstream steps can key
    // off it if they need to branch.
    if (context.dryRun) {
      context.emit?.({
        type: 'log',
        text: `[dry-run] would execute: ${command}`,
        timestamp: new Date(),
      });
      return {
        success: true,
        output: {
          dryRun: true,
          command,
          stdout: '',
          stderr: '',
          exitCode: 0,
        },
        duration: 0,
      };
    }

    const spec: RunnerSpec = {
      command,
      shell: config.shell,
      cwd: safeCwd ?? config.cwd,
      env: config.env,
      timeoutMs: config.timeout ?? 60_000,
      image: config.image,
    };

    const result = await this.runner.run(spec, {
      runId: context.runId,
      stepId: context.stepId,
      tenantId: context.tenantId,
      emit: context.emit,
    });

    const output: ShellOutput = {
      stdout: result.stdout,
      stderr: result.stderr,
      exitCode: result.exitCode,
      command,
    };

    if (result.timedOut) {
      return {
        success: false,
        error: `Command timed out after ${spec.timeoutMs}ms`,
        output: output as unknown as Record<string, unknown>,
        duration: result.durationMs,
      };
    }

    const success = failOnNonZero ? result.exitCode === 0 : true;

    return {
      success,
      output: output as unknown as Record<string, unknown>,
      error: success ? undefined : `Command exited with code ${result.exitCode}`,
      duration: result.durationMs,
    };
  }
}
