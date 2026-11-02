import { spawnSync } from 'child_process';

import { SANDBOX_GID, SANDBOX_UID, sandboxHardeningArgs } from '../runbook/runners/sandbox-profile';

export const SANDBOX_HOME = '/workspace';

const SANDBOX_PATH = [
  `${SANDBOX_HOME}/.local/bin`,
  `${SANDBOX_HOME}/.npm-global/bin`,
  '/usr/local/sbin',
  '/usr/local/bin',
  '/usr/sbin',
  '/usr/bin',
  '/sbin',
  '/bin',
].join(':');

export interface TerminalContainerSpec {
  containerName: string;
  tenantId: string;
  sessionId: string;
  network: string;
  image: string;
  /** Named volume mounted as the home; `null` for a throwaway tmpfs home. */
  volume: string | null;
  runtime?: string;
}

export function buildTerminalDockerArgs(spec: TerminalContainerSpec): string[] {
  // volume-nocopy: with `-w` Docker creates the mountpoint as root in the
  // image and, while the volume is still empty, copies that ownership onto
  // it, undoing prepareWorkspaceVolume.
  const home = spec.volume
    ? ['--mount', `type=volume,source=${spec.volume},target=${SANDBOX_HOME},volume-nocopy=true`]
    : [
        '--tmpfs',
        `${SANDBOX_HOME}:rw,exec,nosuid,nodev,size=256m,uid=${SANDBOX_UID},gid=${SANDBOX_GID}`,
      ];
  return [
    'run',
    '--rm',
    '-it',
    '--name',
    spec.containerName,
    '--label',
    `operari.tenant=${spec.tenantId}`,
    '--label',
    `operari.terminal=${spec.sessionId}`,
    ...(spec.runtime ? ['--runtime', spec.runtime] : []),
    ...sandboxHardeningArgs({ tmpSize: '256m' }),
    '--network',
    spec.network,
    '--memory',
    '512m',
    '--cpus',
    '1',
    '-e',
    'TERM=xterm-256color',
    '-e',
    `HOME=${SANDBOX_HOME}`,
    '-e',
    `PATH=${SANDBOX_PATH}`,
    '-e',
    `NPM_CONFIG_PREFIX=${SANDBOX_HOME}/.npm-global`,
    '-e',
    `PIP_CACHE_DIR=${SANDBOX_HOME}/.cache/pip`,
    '-w',
    SANDBOX_HOME,
    ...home,
    spec.image,
    'sh',
    '-c',
    'command -v bash >/dev/null && exec bash -l || exec sh -l',
  ];
}

/**
 * Docker creates named volumes owned by root, and the sandbox runs as an
 * unprivileged uid, so the volume root is handed over once. Volumes from
 * before the hardening hold root-owned files, hence the recursive chown
 * when the root is not already ours.
 */
export function prepareWorkspaceVolume(dockerBinary: string, volume: string, image: string): void {
  const result = spawnSync(
    dockerBinary,
    [
      'run',
      '--rm',
      '--network',
      'none',
      '--cap-drop=ALL',
      '--cap-add=CHOWN',
      '--cap-add=DAC_OVERRIDE',
      '--cap-add=FOWNER',
      '--security-opt',
      'no-new-privileges',
      '--user',
      '0:0',
      '-v',
      `${volume}:/w`,
      image,
      'sh',
      '-c',
      `[ "$(stat -c %u /w)" = "${SANDBOX_UID}" ] || chown -R ${SANDBOX_UID}:${SANDBOX_GID} /w`,
    ],
    { stdio: 'ignore', timeout: 120_000 }
  );
  if (result.status !== 0) {
    throw new Error(`Could not prepare workspace volume ${volume}`);
  }
}
