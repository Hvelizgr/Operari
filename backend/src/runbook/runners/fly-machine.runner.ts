import { resolveMachineResources } from './machine-presets';
import type { RunChunkBuffer } from './run-chunk-buffer';
import { Runner, RunnerContext, RunnerError, RunnerResult, RunnerSpec } from './runner.types';

/**
 * Subset of `globalThis.fetch` that we depend on. Exposed so tests can
 * inject a fake without monkey-patching.
 */
export type FetchFn = typeof fetch;

export interface FlyMachineRunnerOptions {
  /** Fly.io API token (FLY_API_TOKEN) */
  apiToken: string;
  /** Fly.io app name where ephemeral machines are created */
  appName: string;
  /** Default region (e.g. "iad", "sjc") */
  region?: string;
  /** Default image — must be on a registry Fly can pull from */
  defaultImage?: string;
  /** Override the API base URL (used by tests / private regions) */
  apiBase?: string;
  /** Inject a custom fetch implementation — used by tests */
  fetchImpl?: FetchFn;
  /** Override the wait poll timeout per attempt (default 60s) */
  waitTimeoutSeconds?: number;
  /**
   * Optional sidecar wiring. When all three are supplied the runner
   * wraps the user command with the operari-tee script (see
   * ops/fly-runner-tee.sh), injects callback env vars into the
   * machine, and drains the buffer at finish-time so the returned
   * RunnerResult has real stdout/stderr instead of empty strings.
   *
   * When any field is missing the runner falls back to v1 behaviour
   * — exit code only, stdout/stderr empty. That's the right default
   * for self-host installs that have not configured the sidecar
   * secret.
   */
  chunkBuffer?: RunChunkBuffer;
  /** Public URL the sidecar POSTs to (e.g. https://api.operari.dev/api/internal/run-chunks). */
  chunkCallbackUrl?: string;
  /** Shared HMAC secret. Same value the chunk endpoint uses to verify. */
  chunkSecret?: string;
}

const DEFAULT_API_BASE = 'https://api.machines.dev';
const DEFAULT_IMAGE = 'alpine:3.20';

interface FlyMachineCreateResponse {
  id: string;
  name?: string;
  state: string;
  region?: string;
}

interface FlyMachineState {
  id: string;
  state: string;
  /**
   * Set when the machine has stopped. The structure varies by Fly API
   * version; the only field we read is `exit_code`.
   */
  state_obj?: {
    exit_code?: number;
    exit_event?: { exit_code?: number };
    [k: string]: unknown;
  };
  events?: Array<{
    type: string;
    request?: { exit_event?: { exit_code?: number } };
  }>;
}

/**
 * FlyMachineRunner — executes commands in ephemeral Fly.io Machines.
 *
 * Each `run()` call:
 *   1. POST /v1/apps/:app/machines    → create a one-shot machine
 *   2. GET  /v1/apps/:app/machines/:id/wait?state=stopped  → block
 *   3. GET  /v1/apps/:app/machines/:id  → read final state for exit code
 *   4. DELETE /v1/apps/:app/machines/:id?force=true  → destroy
 *
 * The machine is created with `restart.policy = "no"` so a non-zero exit
 * does not put it into a crash loop. We always destroy at the end, even
 * on error, to avoid orphaning Fly resources and bleeding cost.
 *
 * STDOUT / STDERR: capturing logs from a Firecracker microVM is a
 * separate concern. The Fly Machines API does not return run output
 * inline; logs go through Fly's NATS-based log stream which requires a
 * persistent consumer. For v1 this runner returns the exit code (the
 * most security-critical signal — "did the runbook step succeed?") and
 * leaves stdout/stderr empty. v1.1 will add log capture via a sidecar
 * pattern: the runner image POSTs its own stdout to a Operari callback
 * webhook tagged with the machine id.
 *
 * Pricing reference (verified Q1 2026): shared 256MB ≈ $0.0027/hour,
 * per-second billed, ~125ms cold start.
 *
 * Reference: https://fly.io/docs/machines/api/
 */
export class FlyMachineRunner implements Runner {
  readonly type = 'fly';

  private readonly apiToken: string;
  private readonly appName: string;
  private readonly region?: string;
  private readonly defaultImage: string;
  private readonly apiBase: string;
  private readonly fetchImpl: FetchFn;
  private readonly waitTimeoutSeconds: number;
  private readonly chunkBuffer?: RunChunkBuffer;
  private readonly chunkCallbackUrl?: string;
  private readonly chunkSecret?: string;

  /**
   * Tracks live machine IDs by runId so `cancel(runId)` can issue
   * `DELETE /v1/apps/:app/machines/:id?force=true` for each one. The
   * `finally` block in `run()` removes entries on success or failure.
   */
  private readonly inFlight = new Map<string, Set<string>>();

  constructor(options: FlyMachineRunnerOptions) {
    if (!options.apiToken) {
      throw new RunnerError('FlyMachineRunner requires apiToken');
    }
    if (!options.appName) {
      throw new RunnerError('FlyMachineRunner requires appName');
    }
    this.apiToken = options.apiToken;
    this.appName = options.appName;
    this.region = options.region;
    this.defaultImage = options.defaultImage ?? DEFAULT_IMAGE;
    this.apiBase = (options.apiBase ?? DEFAULT_API_BASE).replace(/\/$/, '');
    this.fetchImpl = options.fetchImpl ?? fetch;
    this.waitTimeoutSeconds = options.waitTimeoutSeconds ?? 60;
    if (options.chunkBuffer && options.chunkCallbackUrl && options.chunkSecret) {
      this.chunkBuffer = options.chunkBuffer;
      this.chunkCallbackUrl = options.chunkCallbackUrl;
      this.chunkSecret = options.chunkSecret;
    }
  }

  /** True when sidecar wiring is fully configured. */
  get sidecarEnabled(): boolean {
    return Boolean(this.chunkBuffer && this.chunkCallbackUrl && this.chunkSecret);
  }

  async healthcheck(): Promise<void> {
    // GET /v1/apps/:app — confirms token + app exist
    const res = await this.callApi(
      'GET',
      `/v1/apps/${encodeURIComponent(this.appName)}`,
      undefined,
      10_000
    );
    if (!res.ok) {
      const body = await res.text().catch(() => '');
      throw new RunnerError(`Fly healthcheck failed: ${res.status} ${body || res.statusText}`);
    }
  }

  /**
   * Build the JSON body for `POST /v1/apps/:app/machines`. Public for
   * testability — every detail of the security profile is verifiable
   * from a unit test.
   */
  buildCreateBody(spec: RunnerSpec, context: RunnerContext): Record<string, unknown> {
    const image = spec.image ?? this.defaultImage;
    const shell = spec.shell ?? 'sh';
    // Resolve resources via the preset layer: explicit `resources`
    // always wins, then `machine` preset, finally `small-1x` (the
    // v1 default of 256MB / 1 vCPU). Same call path the docker
    // runner will use once it picks up the preset abstraction.
    const resolved = resolveMachineResources(
      {
        machine: spec.machine,
        resources: spec.resources,
      },
      { tenantDefaultMachine: context.tenantDefaults?.machine ?? null }
    );
    const memoryMb = resolved.memoryMb;
    const cpus = Math.max(1, Math.round(resolved.cpuMillis / 1000));

    // Network policy: Fly machines always have an interface. We
    // approximate "none" by attaching no services and disabling
    // outbound — but Fly does not currently expose a clean
    // "network none" toggle. Document this trade-off; for hard
    // network isolation use DockerRunner.
    const services: unknown[] = [];

    // When the sidecar is wired, hand the user command to the
    // operari-tee wrapper instead of running it directly. The
    // wrapper (see ops/fly-runner/operari-tee.sh) tees stdout/stderr
    // to the chunk endpoint while preserving the original streams,
    // then exits with the user command's exit code.
    //
    // The runner image is responsible for putting `operari-tee` on
    // $PATH — typically via the reference Dockerfile that COPIES
    // the script to /usr/local/bin/operari-tee. When the operator
    // ships a custom image without the wrapper, the sidecar is
    // disabled by leaving any of `chunkBuffer`, `chunkCallbackUrl`,
    // `chunkSecret` unset and the runner falls back to v1 (empty
    // stdout / stderr).
    const exec = this.sidecarEnabled ? ['operari-tee', spec.command] : [shell, '-c', spec.command];

    const body: Record<string, unknown> = {
      config: {
        image,
        init: { exec },
        restart: { policy: 'no' },
        auto_destroy: false, // We destroy explicitly so we can read final state
        guest: {
          cpu_kind: 'shared',
          cpus,
          memory_mb: memoryMb,
        },
        services,
        env: this.buildEnv(spec),
        metadata: {
          'operari.run.id': context.runId,
          'operari.step.id': context.stepId,
          'operari.tenant.id': context.tenantId,
        },
      },
    };

    if (this.region) (body as Record<string, unknown>).region = this.region;

    return body;
  }

  private buildEnv(spec: RunnerSpec): Record<string, string> {
    const env: Record<string, string> = {};
    if (spec.env) {
      for (const [key, value] of Object.entries(spec.env)) {
        if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(key)) {
          throw new RunnerError(`Invalid env var name: ${key}`);
        }
        env[key] = value;
      }
    }
    if (this.sidecarEnabled) {
      // The wrapper script reads these and signs each chunk POST.
      // Reserved env names — user's `spec.env` is allowed to set
      // them but it would be a foot-gun, so we always overwrite
      // here so the operator can never accidentally disable the
      // sidecar from inside their own runbook.
      env.OPERARI_CALLBACK_URL = this.chunkCallbackUrl!;
      env.OPERARI_CALLBACK_SECRET = this.chunkSecret!;
    }
    return env;
  }

  async run(spec: RunnerSpec, context: RunnerContext): Promise<RunnerResult> {
    const startTime = Date.now();
    const overallTimeoutMs = spec.timeoutMs ?? 60_000;

    let machineId: string | null = null;
    try {
      // 1. CREATE
      const createBody = this.buildCreateBody(spec, context);
      const createRes = await this.callApi(
        'POST',
        `/v1/apps/${encodeURIComponent(this.appName)}/machines`,
        createBody,
        Math.min(overallTimeoutMs, 30_000)
      );
      if (!createRes.ok) {
        const body = await createRes.text().catch(() => '');
        return this.fail(
          startTime,
          `Fly create failed: ${createRes.status} ${body || createRes.statusText}`
        );
      }
      const created = (await createRes.json()) as FlyMachineCreateResponse;
      machineId = created.id;
      this.track(context.runId, machineId);

      // 2. WAIT
      const waitTimeoutSeconds = Math.min(
        this.waitTimeoutSeconds,
        Math.max(1, Math.floor(overallTimeoutMs / 1000))
      );
      const waitRes = await this.callApi(
        'GET',
        `/v1/apps/${encodeURIComponent(this.appName)}/machines/${encodeURIComponent(machineId)}/wait?state=stopped&timeout=${waitTimeoutSeconds}`,
        undefined,
        overallTimeoutMs
      );

      // 408 = wait timeout exceeded
      if (waitRes.status === 408) {
        return this.finish(startTime, {
          exitCode: null,
          timedOut: true,
          machineId,
        });
      }
      if (!waitRes.ok) {
        const body = await waitRes.text().catch(() => '');
        return this.fail(
          startTime,
          `Fly wait failed: ${waitRes.status} ${body || waitRes.statusText}`,
          machineId
        );
      }

      // 3. FETCH STATE
      const stateRes = await this.callApi(
        'GET',
        `/v1/apps/${encodeURIComponent(this.appName)}/machines/${encodeURIComponent(machineId)}`,
        undefined,
        10_000
      );
      if (!stateRes.ok) {
        const body = await stateRes.text().catch(() => '');
        return this.fail(
          startTime,
          `Fly state read failed: ${stateRes.status} ${body || stateRes.statusText}`,
          machineId
        );
      }
      const state = (await stateRes.json()) as FlyMachineState;
      const exitCode = FlyMachineRunner.extractExitCode(state);

      return this.finish(startTime, {
        exitCode,
        timedOut: false,
        machineId,
      });
    } catch (err) {
      return this.fail(startTime, `Fly runner error: ${(err as Error).message}`, machineId);
    } finally {
      // 4. DESTROY (best effort)
      if (machineId) {
        try {
          await this.callApi(
            'DELETE',
            `/v1/apps/${encodeURIComponent(this.appName)}/machines/${encodeURIComponent(machineId)}?force=true`,
            undefined,
            10_000
          );
        } catch {
          // Already failing or already destroyed — log noise only
        }
        this.untrack(context.runId, machineId);
      }
    }
  }

  /**
   * Force-destroy any in-flight machines tagged with `runId`. The
   * `finally` block in `run()` will also try to destroy on its own
   * path; whichever wins, the machine is gone. Returns the count of
   * destroy requests that the API accepted.
   */
  async cancel(runId: string): Promise<number> {
    const set = this.inFlight.get(runId);
    if (!set || set.size === 0) return 0;
    const ids = Array.from(set);
    let count = 0;
    for (const id of ids) {
      try {
        const res = await this.callApi(
          'DELETE',
          `/v1/apps/${encodeURIComponent(this.appName)}/machines/${encodeURIComponent(id)}?force=true`,
          undefined,
          10_000
        );
        if (res.ok) count++;
      } catch {
        // race with the run() finally — already gone
      }
      // Drop any buffered chunks for the cancelled machine. The
      // run() finally would have called drain() on the happy path;
      // on the cancel path we never reach finish() so the entry
      // would leak until process restart.
      this.chunkBuffer?.forget(id);
    }
    return count;
  }

  private track(runId: string, machineId: string): void {
    let set = this.inFlight.get(runId);
    if (!set) {
      set = new Set();
      this.inFlight.set(runId, set);
    }
    set.add(machineId);
  }

  private untrack(runId: string, machineId: string): void {
    const set = this.inFlight.get(runId);
    if (!set) return;
    set.delete(machineId);
    if (set.size === 0) this.inFlight.delete(runId);
  }

  /**
   * Walk the Fly state response and extract the process exit code.
   * The Machines API has changed shape over time, so we look in three
   * places: state_obj.exit_code, state_obj.exit_event.exit_code, and
   * the latest exit_event in the events array.
   */
  static extractExitCode(state: FlyMachineState): number | null {
    if (state.state_obj?.exit_code !== undefined) {
      return state.state_obj.exit_code;
    }
    if (state.state_obj?.exit_event?.exit_code !== undefined) {
      return state.state_obj.exit_event.exit_code;
    }
    const events = state.events ?? [];
    for (let i = events.length - 1; i >= 0; i--) {
      const code = events[i].request?.exit_event?.exit_code;
      if (code !== undefined) return code;
    }
    return null;
  }

  private async callApi(
    method: string,
    path: string,
    body: unknown,
    timeoutMs: number
  ): Promise<Response> {
    const url = `${this.apiBase}${path}`;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      return await this.fetchImpl(url, {
        method,
        headers: {
          Authorization: `Bearer ${this.apiToken}`,
          'Content-Type': 'application/json',
        },
        body: body ? JSON.stringify(body) : undefined,
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timer);
    }
  }

  private finish(
    startTime: number,
    params: { exitCode: number | null; timedOut: boolean; machineId: string }
  ): RunnerResult {
    // Drain whatever the sidecar pushed for this machine. When the
    // sidecar is disabled (or the runner image does not ship the
    // tee wrapper) the buffer is empty and stdout/stderr stay '' —
    // matching v1 behaviour.
    const captured = this.chunkBuffer?.drain(params.machineId) ?? { stdout: '', stderr: '' };
    return {
      exitCode: params.exitCode,
      stdout: captured.stdout,
      stderr: captured.stderr,
      timedOut: params.timedOut,
      durationMs: Date.now() - startTime,
      metadata: { backend: 'fly', machineId: params.machineId },
    };
  }

  private fail(startTime: number, message: string, machineId?: string | null): RunnerResult {
    // A failure path may have buffered chunks (e.g. command ran but
    // wait/state read failed). Drain so they reach the operator
    // even when the runner could not read the exit code, AND so a
    // long-running buffer entry does not leak after the machine is
    // gone.
    const captured = machineId
      ? (this.chunkBuffer?.drain(machineId) ?? { stdout: '', stderr: '' })
      : { stdout: '', stderr: '' };
    // Append the runner-side error message to stderr so the operator
    // sees both the captured machine output and the reason for the
    // failure in one place.
    const stderr = captured.stderr ? `${captured.stderr}\n${message}` : message;
    return {
      exitCode: null,
      stdout: captured.stdout,
      stderr,
      timedOut: false,
      durationMs: Date.now() - startTime,
      metadata: { backend: 'fly', machineId: machineId ?? null },
    };
  }
}
