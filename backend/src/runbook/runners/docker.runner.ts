import { ChildProcessWithoutNullStreams, spawn as nodeSpawn } from 'child_process';
import { randomBytes } from 'crypto';

import { Runner, RunnerContext, RunnerError, RunnerResult, RunnerSpec } from './runner.types';

/**
 * Function shape compatible with `child_process.spawn`. Exposed so tests
 * can inject a fake without monkey-patching globals.
 */
export type SpawnFn = (
  command: string,
  args: readonly string[],
  options?: { env?: Record<string, string | undefined> }
) => ChildProcessWithoutNullStreams;

export interface DockerRunnerOptions {
  /** Default container image when the spec does not provide one */
  defaultImage?: string;
  /** Override for the docker binary (e.g. "podman") */
  dockerBinary?: string;
  /** Inject a custom spawn implementation — used by tests */
  spawnImpl?: SpawnFn;
}

const DEFAULT_IMAGE = 'alpine:3.20';

/**
 * DockerRunner — executes commands inside a fresh, throwaway Docker
 * container.
 *
 * The runner shells out to the local `docker` CLI rather than depending
 * on the `dockerode` library. Trade-offs:
 *
 *   + Zero new npm dependencies (the host already needs docker for the
 *     runner to be useful)
 *   + Symmetric with the existing LocalRunner architecture
 *   + Works with podman or any drop-in replacement via `dockerBinary`
 *   - No programmatic access to richer container lifecycle (image pulls,
 *     pause/resume, exec into a long-lived container)
 *
 * Hardening defaults applied to every run:
 *
 *   --rm                    auto-remove container on exit
 *   --network none          when spec.network === 'none'
 *   --read-only             root filesystem is read-only
 *   --tmpfs /tmp:rw,size=64m  scratch space the runbook can use
 *   --memory <Mi>           hard memory cap
 *   --cpus <fractional>     CPU quota
 *   --pids-limit 256        prevent fork bombs
 *
 * SECURITY: this provides container-grade isolation suitable for
 * self-host multi-tenant. It is NOT a substitute for a microVM. For
 * cloud SaaS use FlyMachineRunner.
 */
export class DockerRunner implements Runner {
  readonly type = 'docker';

  private readonly defaultImage: string;
  private readonly dockerBinary: string;
  private readonly spawnImpl: SpawnFn;

  /**
   * Tracks running container names by runId so `cancel(runId)` can
   * target `docker kill <name>` directly. Killing the local docker CLI
   * subprocess does not stop the container — only `docker kill` does.
   */
  private readonly inFlight = new Map<string, Set<string>>();

  constructor(options: DockerRunnerOptions = {}) {
    this.defaultImage = options.defaultImage ?? DEFAULT_IMAGE;
    this.dockerBinary = options.dockerBinary ?? 'docker';
    this.spawnImpl = options.spawnImpl ?? (nodeSpawn as SpawnFn);
  }

  async healthcheck(): Promise<void> {
    const result = await this.runProcess(['version', '--format', '{{.Server.Version}}'], {
      timeoutMs: 5_000,
    });
    if (result.exitCode !== 0) {
      throw new RunnerError(
        `Docker healthcheck failed: ${result.stderr.trim() || 'docker version exited ' + result.exitCode}`
      );
    }
  }

  async run(spec: RunnerSpec, context: RunnerContext): Promise<RunnerResult> {
    const containerName = DockerRunner.buildContainerName(context);
    const args = this.buildDockerArgs(spec, context, containerName);
    this.track(context.runId, containerName);
    try {
      return await this.runProcess(args, {
        timeoutMs: spec.timeoutMs ?? 60_000,
        emit: context.emit,
      });
    } finally {
      this.untrack(context.runId, containerName);
    }
  }

  /**
   * Cancel any in-flight containers tagged with `runId`. Spawns
   * `docker kill <name>` for each tracked container; failures are
   * swallowed because the most likely reason is "container already
   * exited" which is exactly the behavior we want.
   */
  async cancel(runId: string): Promise<number> {
    const set = this.inFlight.get(runId);
    if (!set || set.size === 0) return 0;
    const names = Array.from(set);
    let count = 0;
    for (const name of names) {
      const ok = await this.killContainer(name);
      if (ok) count++;
    }
    return count;
  }

  private killContainer(name: string): Promise<boolean> {
    return new Promise(resolve => {
      let proc: ChildProcessWithoutNullStreams;
      try {
        proc = this.spawnImpl(this.dockerBinary, ['kill', name]);
      } catch {
        return resolve(false);
      }
      proc.on('error', () => resolve(false));
      proc.on('close', code => resolve(code === 0));
    });
  }

  private track(runId: string, containerName: string): void {
    let set = this.inFlight.get(runId);
    if (!set) {
      set = new Set();
      this.inFlight.set(runId, set);
    }
    set.add(containerName);
  }

  private untrack(runId: string, containerName: string): void {
    const set = this.inFlight.get(runId);
    if (!set) return;
    set.delete(containerName);
    if (set.size === 0) this.inFlight.delete(runId);
  }

  /**
   * Build a deterministic-but-unique container name. Docker container
   * names must match `[a-zA-Z0-9][a-zA-Z0-9_.-]*`, so we sanitize the
   * runId/stepId and append random entropy to avoid collisions when a
   * step is retried within the same run.
   */
  static buildContainerName(context: RunnerContext): string {
    const safe = (s: string) => s.replace(/[^a-zA-Z0-9_.-]/g, '_').slice(0, 32);
    const suffix = randomBytes(4).toString('hex');
    return `operari-${safe(context.runId)}-${safe(context.stepId)}-${suffix}`;
  }

  /**
   * Build the full `docker run …` argv. Public for testability — every
   * detail of the security profile is verifiable from a unit test.
   *
   * `containerName` is used to make the container addressable from
   * `cancel(runId)` via `docker kill <name>`. Callers that don't need
   * cancellation (tests, healthcheck shape verification) may omit it.
   */
  buildDockerArgs(spec: RunnerSpec, context: RunnerContext, containerName?: string): string[] {
    const image = spec.image ?? this.defaultImage;
    const shell = spec.shell ?? 'sh';
    const args: string[] = ['run', '--rm', '-i'];

    if (containerName) {
      args.push('--name', containerName);
    }

    // ---- isolation ----
    args.push('--read-only');
    args.push('--tmpfs', '/tmp:rw,size=64m,mode=1777');
    args.push('--pids-limit', '256');

    // ---- network policy ----
    if (spec.network === 'none' || spec.network === undefined) {
      // Default to none — runbooks must opt in to network access
      args.push('--network', 'none');
    } else if (spec.network === 'open') {
      args.push('--network', 'bridge');
    } else if (spec.network === 'allowlist') {
      // Docker has no native allowlist; treat as bridge and let an
      // outer policy (iptables, gVisor, etc.) enforce. Document loud.
      args.push('--network', 'bridge');
    }

    // ---- resource limits ----
    const memMb = spec.resources?.memoryMb ?? 512;
    args.push('--memory', `${memMb}m`);
    const cpuMillis = spec.resources?.cpuMillis ?? 1000;
    args.push('--cpus', (cpuMillis / 1000).toFixed(3));

    // ---- env ----
    if (spec.env) {
      for (const [key, value] of Object.entries(spec.env)) {
        if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(key)) {
          throw new RunnerError(`Invalid env var name: ${key}`);
        }
        args.push('-e', `${key}=${value}`);
      }
    }

    // ---- working dir ----
    if (spec.cwd) {
      args.push('--workdir', spec.cwd);
    }

    // ---- labels for audit / quota tracking ----
    args.push('--label', `operari.run.id=${context.runId}`);
    args.push('--label', `operari.step.id=${context.stepId}`);
    args.push('--label', `operari.tenant.id=${context.tenantId}`);

    // ---- image and command ----
    args.push(image);
    args.push(shell, '-c', spec.command);

    return args;
  }

  /**
   * Spawn the docker binary with the given args, capturing stdout/stderr
   * and enforcing a wall-clock timeout. Shared by `run()` and
   * `healthcheck()`.
   */
  private runProcess(
    args: string[],
    options: { timeoutMs: number; emit?: RunnerContext['emit'] }
  ): Promise<RunnerResult> {
    const startTime = Date.now();
    return new Promise<RunnerResult>(resolve => {
      let proc: ChildProcessWithoutNullStreams;
      try {
        proc = this.spawnImpl(this.dockerBinary, args);
      } catch (err) {
        return resolve({
          exitCode: null,
          stdout: '',
          stderr: `[runner] failed to spawn docker: ${(err as Error).message}`,
          timedOut: false,
          durationMs: Date.now() - startTime,
        });
      }

      let stdout = '';
      let stderr = '';
      let timedOut = false;

      const timer = setTimeout(() => {
        timedOut = true;
        proc.kill('SIGKILL');
      }, options.timeoutMs);

      proc.stdout?.on('data', (chunk: Buffer) => {
        const text = chunk.toString();
        stdout += text;
        options.emit?.({ type: 'stdout', text, timestamp: new Date() });
      });

      proc.stderr?.on('data', (chunk: Buffer) => {
        const text = chunk.toString();
        stderr += text;
        options.emit?.({ type: 'stderr', text, timestamp: new Date() });
      });

      proc.on('error', err => {
        clearTimeout(timer);
        resolve({
          exitCode: null,
          stdout,
          stderr: stderr + `\n[runner] docker spawn error: ${err.message}`,
          timedOut: false,
          durationMs: Date.now() - startTime,
        });
      });

      proc.on('close', exitCode => {
        clearTimeout(timer);
        resolve({
          exitCode,
          stdout: stdout.trimEnd(),
          stderr: stderr.trimEnd(),
          timedOut,
          durationMs: Date.now() - startTime,
          metadata: { binary: this.dockerBinary },
        });
      });
    });
  }
}
