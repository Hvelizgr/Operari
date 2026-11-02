import { spawn as nodeSpawn, spawnSync as nodeSpawnSync } from 'child_process';

type SpawnSync = (
  command: string,
  args: string[],
  options: { encoding: 'utf8'; timeout: number }
) => { status: number | null; stdout: string };
type Spawn = (
  command: string,
  args: string[],
  options: { stdio: 'ignore' }
) => {
  on(event: 'error', listener: () => void): unknown;
};

const LABELS = ['operari.terminal', 'operari.run.id'];

/**
 * Containers left by a previous sandbox-runner process (crash, restart,
 * `rm -f`) have nobody reading them and would run until their shell exits,
 * so they are killed at startup. The daemon belongs to the sandbox user
 * alone, so every container carrying these labels is ours.
 */
export function killOrphans(
  dockerBinary: string,
  spawnSync: SpawnSync = nodeSpawnSync as unknown as SpawnSync
): string[] {
  const ids = new Set<string>();
  for (const label of LABELS) {
    const ps = spawnSync(dockerBinary, ['ps', '-q', '--filter', `label=${label}`], {
      encoding: 'utf8',
      timeout: 30_000,
    });
    if (ps.status !== 0) continue;
    for (const id of ps.stdout.split('\n').map(s => s.trim())) if (id) ids.add(id);
  }
  if (ids.size > 0) {
    spawnSync(dockerBinary, ['kill', ...ids], { encoding: 'utf8', timeout: 30_000 });
  }
  return Array.from(ids);
}

/**
 * Pulls the allowed images in the background so a step's first run does not
 * stream `docker pull` progress into its stderr.
 */
export function prefetchImages(
  dockerBinary: string,
  images: string[],
  spawn: Spawn = nodeSpawn as unknown as Spawn
): void {
  for (const image of new Set(images)) {
    try {
      spawn(dockerBinary, ['pull', '-q', image], { stdio: 'ignore' }).on('error', () => undefined);
    } catch {
      // The run will pull it on demand.
    }
  }
}
