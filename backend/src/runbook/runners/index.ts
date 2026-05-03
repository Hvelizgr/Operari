import { DockerRunner, DockerRunnerOptions } from './docker.runner';
import { FlyMachineRunner, FlyMachineRunnerOptions } from './fly-machine.runner';
import { LocalRunner } from './local.runner';
import { RunChunkBuffer } from './run-chunk-buffer';
import { Runner, RunnerError } from './runner.types';

export { DockerRunner } from './docker.runner';
export { FlyMachineRunner } from './fly-machine.runner';
export { LocalRunner, localRunner } from './local.runner';
export { RunChunkBuffer } from './run-chunk-buffer';
export * from './runner.types';

export type RunnerType = 'local' | 'docker' | 'fly';

export interface RunnerRegistryOptions {
  /** Which backend to use as the default runner */
  type: RunnerType;
  /** Optional config for the docker runner */
  docker?: DockerRunnerOptions;
  /** Required when type === "fly" */
  fly?: FlyMachineRunnerOptions;
}

/**
 * Build the configured runner. Throws if the requested backend is not
 * usable (missing credentials, missing dependency, …).
 *
 * Read configuration from env in production via {@link runnerOptionsFromEnv}.
 */
export function createRunner(options: RunnerRegistryOptions): Runner {
  switch (options.type) {
    case 'local':
      return new LocalRunner();
    case 'docker':
      return new DockerRunner(options.docker);
    case 'fly':
      if (!options.fly) {
        throw new RunnerError(
          'createRunner({ type: "fly" }) requires fly options (apiToken, appName)'
        );
      }
      return new FlyMachineRunner(options.fly);
    default: {
      const exhaustive: never = options.type;
      throw new RunnerError(`Unknown runner type: ${exhaustive as string}`);
    }
  }
}

/**
 * Read runner configuration from process.env.
 *
 * Variables:
 *   OPERARI_RUNNER         = "local" | "docker" | "fly"   (default: "local")
 *   OPERARI_RUNNER_IMAGE   = "ghcr.io/operari/runner:..." (optional default image for docker/fly)
 *   DOCKER_BINARY          = "podman" | "docker"          (optional, docker only)
 *   FLY_API_TOKEN          = ...                          (required if "fly")
 *   FLY_APP_NAME           = ...                          (required if "fly")
 *   FLY_REGION             = "iad" | "sjc" | ...          (optional)
 *
 * Sidecar (Fly only — log capture via the operari-tee wrapper):
 *   OPERARI_RUN_CHUNK_SECRET        HMAC shared secret. When unset
 *                                   the sidecar is disabled and stdout
 *                                   /stderr come back empty (v1).
 *   OPERARI_RUN_CHUNK_CALLBACK_URL  Public URL of the chunk endpoint
 *                                   (e.g. https://api.operari.dev/api/internal/run-chunks).
 *                                   The Fly machine POSTs each line
 *                                   here, so it must be reachable from
 *                                   the Fly network.
 */
export function runnerOptionsFromEnv(env: NodeJS.ProcessEnv = process.env): RunnerRegistryOptions {
  const type = (env.OPERARI_RUNNER ?? 'local') as RunnerType;

  if (type === 'fly') {
    const chunkSecret = env.OPERARI_RUN_CHUNK_SECRET;
    const chunkCallbackUrl = env.OPERARI_RUN_CHUNK_CALLBACK_URL;
    return {
      type: 'fly',
      fly: {
        apiToken: env.FLY_API_TOKEN ?? '',
        appName: env.FLY_APP_NAME ?? '',
        region: env.FLY_REGION,
        defaultImage: env.OPERARI_RUNNER_IMAGE,
        ...(chunkSecret && chunkCallbackUrl
          ? {
              chunkBuffer: getRunChunkBuffer(),
              chunkCallbackUrl,
              chunkSecret,
            }
          : {}),
      },
    };
  }

  if (type === 'docker') {
    return {
      type: 'docker',
      docker: {
        defaultImage: env.OPERARI_RUNNER_IMAGE,
        dockerBinary: env.DOCKER_BINARY,
      },
    };
  }

  return { type };
}

/**
 * Process-wide singleton runner. Built lazily from `runnerOptionsFromEnv()`
 * the first time it is requested. Both the executor registry and the
 * cancel endpoint use this so that:
 *
 *   1. There is exactly one in-flight tracking table per process.
 *   2. The cancel endpoint can target the same runner that ran the step.
 *
 * Tests can override the singleton with `setRunnerForTest()` and reset
 * with `resetRunnerForTest()`.
 */
let runnerSingleton: Runner | null = null;

export function getRunner(): Runner {
  if (!runnerSingleton) {
    runnerSingleton = createRunner(runnerOptionsFromEnv());
  }
  return runnerSingleton;
}

export function setRunnerForTest(runner: Runner): void {
  runnerSingleton = runner;
}

export function resetRunnerForTest(): void {
  runnerSingleton = null;
}

/**
 * Process-wide RunChunkBuffer singleton. Lazily constructed the first
 * time it is requested so installs without the sidecar configured pay
 * zero memory. Both `runnerOptionsFromEnv` (which feeds the
 * FlyMachineRunner) and the chunk endpoint (which feeds the buffer
 * from the receiving side) read this so the same buffer instance is
 * on both ends.
 */
let chunkBufferSingleton: RunChunkBuffer | null = null;

export function getRunChunkBuffer(): RunChunkBuffer {
  if (!chunkBufferSingleton) {
    chunkBufferSingleton = new RunChunkBuffer();
  }
  return chunkBufferSingleton;
}

export function resetRunChunkBufferForTest(): void {
  chunkBufferSingleton = null;
}
