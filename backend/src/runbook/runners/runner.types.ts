/**
 * Runner abstraction — the layer that actually executes commands.
 *
 * StepExecutors (shell, http, kubectl…) describe WHAT to run.
 * Runners decide WHERE and HOW it runs:
 *
 *   - LocalRunner       → spawn on the host (self-host single-tenant only)
 *   - DockerRunner      → ephemeral container per execution (self-host hardened)
 *   - FlyMachineRunner  → Fly.io Machines / Firecracker microVM (cloud SaaS)
 *   - K8sJobRunner      → Kubernetes Job in customer cluster (BYO compute)
 *
 * The interface is intentionally narrow so new backends can be added without
 * touching executors. Anything specific to a backend goes in the spec.
 */

import type { ExecutorEvent } from '../types/executor.types';

export type NetworkPolicy = 'none' | 'allowlist' | 'open';

export interface RunnerSpec {
  /** Shell command to execute */
  command: string;
  /** Shell binary (default: "sh") */
  shell?: string;
  /** Working directory inside the runner */
  cwd?: string;
  /** Environment variables to inject */
  env?: Record<string, string>;
  /** Hard timeout in milliseconds (default: 60_000) */
  timeoutMs?: number;
  /**
   * Container image (Docker / Fly only). Ignored by LocalRunner.
   * Default per-runner; typically "alpine:3.20" or a Operari base image.
   */
  image?: string;
  /**
   * Network policy. LocalRunner ignores this (host network).
   *   - none       → no network access
   *   - allowlist  → only `allowedHosts` reachable
   *   - open       → unrestricted (default for self-host)
   */
  network?: NetworkPolicy;
  /** Hosts allowed when network = "allowlist" */
  allowedHosts?: string[];
  /**
   * Resource limits. LocalRunner ignores. Other runners enforce.
   */
  resources?: {
    cpuMillis?: number;
    memoryMb?: number;
    diskMb?: number;
  };
  /**
   * Files to mount into the runner before execution.
   * Map of in-runner-path → file content (utf-8).
   */
  files?: Record<string, string>;
}

export interface RunnerResult {
  /** Process exit code (null if killed by signal) */
  exitCode: number | null;
  /** Captured stdout (already streamed via emit) */
  stdout: string;
  /** Captured stderr (already streamed via emit) */
  stderr: string;
  /** True if the runner killed the process due to timeout */
  timedOut: boolean;
  /** Total wall-clock duration in ms */
  durationMs: number;
  /** Optional backend-specific metadata (machine ID, container ID, …) */
  metadata?: Record<string, unknown>;
}

export interface RunnerContext {
  /** Run ID — used for tagging / metadata */
  runId: string;
  /** Step ID inside the run */
  stepId: string;
  /** Tenant ID for isolation and quota tracking */
  tenantId: string;
  /** Streaming emitter for stdout/stderr lines */
  emit?: (event: ExecutorEvent) => void;
}

export interface Runner {
  /** Stable identifier: "local" | "docker" | "fly" | "k8s" | … */
  readonly type: string;
  /** Execute the spec and return when done (or timed out). */
  run(spec: RunnerSpec, context: RunnerContext): Promise<RunnerResult>;
  /**
   * Cancel any in-flight executions tagged with `runId`. A run may have
   * multiple concurrent steps, so this targets the run as a whole, not
   * a single step.
   *
   * Returns the number of in-flight processes / containers / machines
   * that were signalled (0 if the run was not found, which is normal —
   * the operator may be cancelling a run that already finished).
   *
   * Implementations MUST be best-effort and idempotent: a second call
   * for the same runId is a no-op once the first one has cleared the
   * tracking table. They MUST NOT throw on "not found" — the cancel
   * endpoint relies on this to be safe to retry.
   */
  cancel?(runId: string): Promise<number>;
  /** Optional: pre-flight check (e.g. docker daemon reachable). */
  healthcheck?(): Promise<void>;
}

export class RunnerError extends Error {
  constructor(
    message: string,
    public readonly cause?: unknown
  ) {
    super(message);
    this.name = 'RunnerError';
  }
}
