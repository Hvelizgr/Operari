import { spawn, ChildProcess } from 'child_process';
import { mkdtempSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import {
    Runner,
    RunnerContext,
    RunnerResult,
    RunnerSpec,
} from './runner.types';

/**
 * Env vars that should NEVER leak into step commands. Even in
 * single-tenant self-host, a buggy step printing `env` would expose
 * the backend's secrets.
 */
const FILTERED_ENV_KEYS = [
    'ENCRYPTION_KEY',
    'JWT_SECRET',
    'DATABASE_URL',
    'ANTHROPIC_API_KEY',
    'OPENAI_API_KEY',
    'GMAIL_CLIENT_SECRET',
    'SLACK_CLIENT_SECRET',
    'REDIS_URL',
];

/**
 * LocalRunner — executes commands directly on the backend host process.
 *
 * SECURITY: This runner provides ZERO isolation. A malicious or buggy
 * runbook can read/write any file the backend process can, exfiltrate
 * secrets, fork bombs, etc.
 *
 * WHEN TO USE:
 *   ✅ Self-hosted single-tenant deployments where the operator owns
 *      both the runbooks and the host.
 *   ✅ Local development of NanoRun itself.
 *   ❌ Cloud SaaS — use FlyMachineRunner.
 *   ❌ Multi-tenant self-host — use DockerRunner.
 *
 * Resource limits, network policies, mounted files, and image selection
 * are all silently ignored — LocalRunner only respects command/shell/
 * cwd/env/timeoutMs.
 */
export class LocalRunner implements Runner {
    readonly type = 'local';

    /**
     * Tracks in-flight processes by runId so `cancel(runId)` can find
     * them. A single run may have multiple concurrent steps, hence the
     * Set. Entries are removed in the `close` / `error` handlers.
     */
    private readonly inFlight = new Map<string, Set<ChildProcess>>();

    async run(spec: RunnerSpec, context: RunnerContext): Promise<RunnerResult> {
        const startTime = Date.now();
        const shell = spec.shell ?? 'sh';
        const timeoutMs = spec.timeoutMs ?? 60_000;

        // Create an isolated tmpdir for each step so commands can't
        // read/write each other's temp files. Cleaned up after execution.
        const stepTmpDir = mkdtempSync(join(tmpdir(), `nanorun-${context.runId}-`));
        const cwd = spec.cwd ?? stepTmpDir;

        // Filter dangerous env vars from the inherited environment
        const safeEnv: Record<string, string | undefined> = { ...process.env };
        for (const key of FILTERED_ENV_KEYS) {
            delete safeEnv[key];
        }
        // TMPDIR/TMP/TEMP point to the isolated tmpdir
        safeEnv.TMPDIR = stepTmpDir;
        safeEnv.TMP = stepTmpDir;
        safeEnv.TEMP = stepTmpDir;
        // Merge step-specific env vars on top
        Object.assign(safeEnv, spec.env ?? {});

        return new Promise<RunnerResult>((resolve) => {
            const proc = spawn(shell, ['-c', spec.command], {
                cwd,
                env: safeEnv,
            });

            this.track(context.runId, proc);

            let stdout = '';
            let stderr = '';
            let timedOut = false;

            const timer = setTimeout(() => {
                timedOut = true;
                proc.kill('SIGKILL');
            }, timeoutMs);

            proc.stdout?.on('data', (chunk: Buffer) => {
                const text = chunk.toString();
                stdout += text;
                context.emit?.({ type: 'stdout', text, timestamp: new Date() });
            });

            proc.stderr?.on('data', (chunk: Buffer) => {
                const text = chunk.toString();
                stderr += text;
                context.emit?.({ type: 'stderr', text, timestamp: new Date() });
            });

            proc.on('error', (err) => {
                clearTimeout(timer);
                this.untrack(context.runId, proc);
                try { rmSync(stepTmpDir, { recursive: true, force: true }); } catch { /* best-effort */ }
                resolve({
                    exitCode: null,
                    stdout,
                    stderr: stderr + `\n[runner] failed to spawn: ${err.message}`,
                    timedOut: false,
                    durationMs: Date.now() - startTime,
                });
            });

            proc.on('close', (exitCode) => {
                clearTimeout(timer);
                this.untrack(context.runId, proc);
                try { rmSync(stepTmpDir, { recursive: true, force: true }); } catch { /* best-effort */ }
                resolve({
                    exitCode,
                    stdout: stdout.trimEnd(),
                    stderr: stderr.trimEnd(),
                    timedOut,
                    durationMs: Date.now() - startTime,
                });
            });
        });
    }

    async cancel(runId: string): Promise<number> {
        const set = this.inFlight.get(runId);
        if (!set || set.size === 0) return 0;
        let count = 0;
        for (const proc of set) {
            try {
                proc.kill('SIGKILL');
                count++;
            } catch {
                // process already exited between the lookup and the kill
            }
        }
        return count;
    }

    private track(runId: string, proc: ChildProcess): void {
        let set = this.inFlight.get(runId);
        if (!set) {
            set = new Set();
            this.inFlight.set(runId, set);
        }
        set.add(proc);
    }

    private untrack(runId: string, proc: ChildProcess): void {
        const set = this.inFlight.get(runId);
        if (!set) return;
        set.delete(proc);
        if (set.size === 0) this.inFlight.delete(runId);
    }
}

export const localRunner = new LocalRunner();
