import { DockerRunner, DockerRunnerOptions } from './docker.runner';
import { FlyMachineRunner, FlyMachineRunnerOptions } from './fly-machine.runner';
import { LocalRunner } from './local.runner';
import { Runner, RunnerError } from './runner.types';

export { DockerRunner } from './docker.runner';
export { FlyMachineRunner } from './fly-machine.runner';
export { LocalRunner, localRunner } from './local.runner';
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
 *   NANORUN_RUNNER         = "local" | "docker" | "fly"   (default: "local")
 *   NANORUN_RUNNER_IMAGE   = "ghcr.io/nanorun/runner:..." (optional default image for docker/fly)
 *   DOCKER_BINARY          = "podman" | "docker"          (optional, docker only)
 *   FLY_API_TOKEN          = ...                          (required if "fly")
 *   FLY_APP_NAME           = ...                          (required if "fly")
 *   FLY_REGION             = "iad" | "sjc" | ...          (optional)
 */
export function runnerOptionsFromEnv(env: NodeJS.ProcessEnv = process.env): RunnerRegistryOptions {
  const type = (env.NANORUN_RUNNER ?? 'local') as RunnerType;

  if (type === 'fly') {
    return {
      type: 'fly',
      fly: {
        apiToken: env.FLY_API_TOKEN ?? '',
        appName: env.FLY_APP_NAME ?? '',
        region: env.FLY_REGION,
        defaultImage: env.NANORUN_RUNNER_IMAGE,
      },
    };
  }

  if (type === 'docker') {
    return {
      type: 'docker',
      docker: {
        defaultImage: env.NANORUN_RUNNER_IMAGE,
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
