import type { TenantPolicy } from '../../policy/tenant-policy';
import { SandboxClient } from '../../sandbox/client';
import type { RunRequest } from '../../sandbox/protocol';
import { Runner, RunnerContext, RunnerError, RunnerResult, RunnerSpec } from './runner.types';

/**
 * Runs steps through the sandbox-runner service, which owns the (rootless)
 * Docker daemon. The backend never holds a Docker socket; it only describes
 * the step, and the service applies the container profile.
 */
export class SandboxRunner implements Runner {
  readonly type = 'sandbox';

  private policyFor: ((tenantId: string) => Promise<TenantPolicy>) | null = null;

  constructor(readonly client: SandboxClient) {}

  /** Workspace egress policy becomes the ceiling for every step's network. */
  usePolicy(policyFor: (tenantId: string) => Promise<TenantPolicy>): void {
    this.policyFor = policyFor;
  }

  /**
   * What the step asked for, capped by the workspace. Fails closed: if the
   * policy cannot be read the step gets no network.
   */
  async effectiveNetwork(
    spec: RunnerSpec,
    tenantId: string
  ): Promise<Pick<RunnerSpec, 'network' | 'allowedHosts'>> {
    const requested = spec.network ?? 'none';
    if (requested === 'none') return { network: 'none' };
    if (!this.policyFor) return { network: requested, allowedHosts: spec.allowedHosts };
    let policy: TenantPolicy;
    try {
      policy = await this.policyFor(tenantId);
    } catch {
      return { network: 'none' };
    }
    return egressFor(policy, requested, spec.allowedHosts);
  }

  async healthcheck(): Promise<void> {
    try {
      await this.client.health();
    } catch (err) {
      throw new RunnerError(`Sandbox healthcheck failed: ${(err as Error).message}`, err);
    }
  }

  async run(spec: RunnerSpec, context: RunnerContext): Promise<RunnerResult> {
    const started = Date.now();
    const shell = spec.shell ?? 'sh';
    if (shell !== 'sh' && shell !== 'bash') {
      throw new RunnerError(`Unsupported shell for the sandbox runner: ${shell}`);
    }
    const net = await this.effectiveNetwork(spec, context.tenantId);
    const payload: RunRequest = {
      spec: {
        command: spec.command,
        shell,
        cwd: spec.cwd,
        env: spec.env,
        timeoutMs: spec.timeoutMs,
        image: spec.image,
        network: net.network,
        allowedHosts: net.allowedHosts,
        resources: spec.resources
          ? { cpuMillis: spec.resources.cpuMillis, memoryMb: spec.resources.memoryMb }
          : undefined,
      },
      context: { runId: context.runId, stepId: context.stepId, tenantId: context.tenantId },
    };

    let result: RunnerResult | null = null;
    let failure: string | null = null;
    let stdout = '';
    let stderr = '';
    try {
      await this.client.run(payload, line => {
        switch (line.t) {
          case 'stdout':
            stdout += line.d;
            context.emit?.({ type: 'stdout', text: line.d, timestamp: new Date() });
            break;
          case 'stderr':
            stderr += line.d;
            context.emit?.({ type: 'stderr', text: line.d, timestamp: new Date() });
            break;
          case 'result': {
            const { t: _t, ...rest } = line;
            result = { ...rest, metadata: { runner: 'sandbox' } };
            break;
          }
          case 'error':
            failure = line.message;
        }
      });
    } catch (err) {
      failure = (err as Error).message;
    }
    if (result) return result;
    return {
      exitCode: null,
      stdout,
      stderr: (stderr ? stderr + '\n' : '') + `[runner] ${failure ?? 'sandbox closed the stream'}`,
      timedOut: false,
      durationMs: Date.now() - started,
    };
  }

  async cancel(runId: string): Promise<number> {
    try {
      return await this.client.cancel(runId);
    } catch {
      return 0;
    }
  }
}

export function egressFor(
  policy: TenantPolicy,
  requested: 'open' | 'allowlist',
  stepHosts?: string[]
): Pick<RunnerSpec, 'network' | 'allowedHosts'> {
  if (policy.sandboxEgress === 'none') return { network: 'none' };
  if (policy.sandboxEgress === 'allowlist') {
    return policy.egressAllowlist.length
      ? { network: 'allowlist', allowedHosts: policy.egressAllowlist }
      : { network: 'none' };
  }
  if (requested === 'allowlist' && stepHosts?.length) {
    return { network: 'allowlist', allowedHosts: stepHosts };
  }
  return { network: 'open' };
}
