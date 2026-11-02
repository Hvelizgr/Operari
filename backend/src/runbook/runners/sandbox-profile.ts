/**
 * Container flags shared by every sandboxed process (runbook steps on the
 * docker runner and interactive terminals). One place so the two paths
 * cannot drift apart. Rationale and threat model: docs/sandbox-research.md.
 */

/**
 * Network created by deploy/sandbox/setup-network.sh: internet only, with
 * DOCKER-USER/INPUT rules that drop private ranges, metadata and the host.
 */
export const DEFAULT_SANDBOX_NETWORK = 'operari-sandbox';

export const SANDBOX_UID = 1000;
export const SANDBOX_GID = 1000;

export interface SandboxProfileOptions {
  /** Size of the writable /tmp tmpfs, e.g. "64m". */
  tmpSize?: string;
}

export function sandboxHardeningArgs(options: SandboxProfileOptions = {}): string[] {
  return [
    '--cap-drop=ALL',
    '--security-opt',
    'no-new-privileges',
    '--user',
    `${SANDBOX_UID}:${SANDBOX_GID}`,
    '--read-only',
    '--tmpfs',
    `/tmp:rw,nosuid,nodev,size=${options.tmpSize ?? '64m'},mode=1777`,
    '--pids-limit',
    '256',
  ];
}

/**
 * `bridge`, `host` and the compose networks would hand the sandbox a route to
 * Postgres, Redis or the other sites, so only `none` or a dedicated network
 * is accepted.
 */
export function assertSandboxNetwork(network: string): string {
  if (network === 'none') return network;
  if (network === 'host' || network === 'bridge' || network === 'default') {
    throw new Error(
      `Refusing sandbox network "${network}": it reaches the host or other containers. ` +
        `Use "none" or the isolated "${DEFAULT_SANDBOX_NETWORK}" network (deploy/sandbox/setup-network.sh).`
    );
  }
  if (network.startsWith('container:')) {
    throw new Error(
      `Refusing sandbox network "${network}": it shares another container's namespace.`
    );
  }
  if (!/^[A-Za-z0-9][A-Za-z0-9_.-]{0,127}$/.test(network)) {
    throw new Error(`Invalid sandbox network name: ${network}`);
  }
  return network;
}
