import {
    StepExecutor,
    ExecutorContext,
    ExecutorResult,
    resolveTemplate,
} from '../types/executor.types';
import { Runner, RunnerSpec } from '../runners/runner.types';

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
 * Shell command executor — the heart of NanoRun.
 *
 * Delegates actual execution to a {@link Runner}, which decides where the
 * command runs (host process, ephemeral container, Firecracker microVM, …).
 *
 * The executor itself is responsible for:
 *   - Template resolution ({{vars.x}}, {{steps.foo.output.bar}})
 *   - Mapping RunnerResult → ExecutorResult
 *   - Streaming output via context.emit (the Runner already does this)
 *
 * Choice of Runner is configured at startup via NANORUN_RUNNER (see
 * runners/index.ts). Default is LocalRunner for backwards compatibility
 * with existing self-host deployments.
 */
export class ShellExecutor implements StepExecutor<ShellConfig> {
    readonly type = 'shell';

    constructor(private readonly runner: Runner) { }

    async execute(config: ShellConfig, context: ExecutorContext): Promise<ExecutorResult> {
        const command = resolveTemplate(config.command, context);
        const failOnNonZero = config.failOnNonZeroExit ?? true;

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
            cwd: config.cwd,
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
