import { spawnSync as nodeSpawnSync } from 'child_process';
import { randomBytes, randomInt } from 'crypto';
import { readFileSync } from 'fs';
import { join } from 'path';

import { signGrant } from './egress-proxy';

export const EGRESS_PROXY_NAME = 'operari-egress';
export const EGRESS_LABEL = 'operari.egress';
const PROXY_PORT = 3128;

type SpawnSync = (
  command: string,
  args: string[],
  options: { encoding: 'utf8'; timeout: number }
) => { status: number | null; stdout: string; stderr: string };

export interface EgressAttachment {
  /** Network the sandbox joins: internal, shared only with the proxy. */
  network: string;
  /** HTTP(S)_PROXY and friends, carrying the signed host grant. */
  env: Record<string, string>;
  release(): void;
}

export interface EgressController {
  attach(id: string, hosts: string[], ttlSeconds: number): EgressAttachment;
}

export interface DockerEgressOptions {
  dockerBinary: string;
  /** Internet-only network the proxy itself uses to reach allowed hosts. */
  upstreamNetwork: string;
  proxyImage?: string;
  runtime?: string;
  /** Proxy source run with `node -e`; defaults to the compiled egress-proxy.js next to this file. */
  proxyScript?: string;
  spawnSync?: SpawnSync;
  now?: () => number;
}

/**
 * One egress proxy container on the rootless daemon, plus a private
 * `--internal` /29 network per sandbox that only the sandbox and the proxy
 * join. Sandboxes therefore cannot reach each other (a shared network
 * would need ICC, and ICC off would also cut them from the proxy) and have
 * no route out except through the proxy.
 */
export class DockerEgressController implements EgressController {
  private readonly secret = randomBytes(32).toString('hex');
  private readonly run: SpawnSync;
  private readonly now: () => number;

  constructor(private readonly opts: DockerEgressOptions) {
    this.run = opts.spawnSync ?? (nodeSpawnSync as unknown as SpawnSync);
    this.now = opts.now ?? Date.now;
  }

  private docker(args: string[], timeout = 30_000) {
    const result = this.run(this.opts.dockerBinary, args, { encoding: 'utf8', timeout });
    if (result.status !== 0) {
      throw new Error(`docker ${args[0]} ${args[1] ?? ''} failed: ${(result.stderr || '').trim()}`);
    }
    return result.stdout.trim();
  }

  /** (Re)starts the proxy with a fresh secret: grants from a previous process stop working. */
  start(): void {
    this.run(this.opts.dockerBinary, ['rm', '-f', EGRESS_PROXY_NAME], {
      encoding: 'utf8',
      timeout: 30_000,
    });
    const script =
      this.opts.proxyScript ?? readFileSync(join(__dirname, 'egress-proxy.js'), 'utf8');
    this.docker(
      [
        'run',
        '-d',
        '--name',
        EGRESS_PROXY_NAME,
        '--label',
        `${EGRESS_LABEL}=proxy`,
        '--restart',
        'unless-stopped',
        ...(this.opts.runtime ? ['--runtime', this.opts.runtime] : []),
        '--cap-drop=ALL',
        '--security-opt',
        'no-new-privileges',
        '--user',
        '1000:1000',
        '--read-only',
        '--memory',
        '256m',
        '--pids-limit',
        '128',
        '--network',
        this.opts.upstreamNetwork,
        '-e',
        'OPERARI_EGRESS_PROXY_MAIN=1',
        '-e',
        `OPERARI_EGRESS_SECRET=${this.secret}`,
        this.opts.proxyImage ?? 'node:20-alpine',
        'node',
        '-e',
        script,
      ],
      120_000
    );
  }

  attach(id: string, hosts: string[], ttlSeconds: number): EgressAttachment {
    const network = `operari-eg-${id.replace(/[^a-zA-Z0-9_.-]/g, '').slice(0, 40)}`;
    let created = false;
    for (let attempt = 0; attempt < 8 && !created; attempt++) {
      const slot = randomInt(0, 8192);
      const subnet = `10.213.${slot >> 5}.${(slot & 31) * 8}/29`;
      const result = this.run(
        this.opts.dockerBinary,
        [
          'network',
          'create',
          '--internal',
          '--subnet',
          subnet,
          '--label',
          `${EGRESS_LABEL}=sandbox`,
          network,
        ],
        { encoding: 'utf8', timeout: 30_000 }
      );
      if (result.status === 0) created = true;
      else if (!/overlap|already|in use/i.test(result.stderr)) {
        throw new Error(`could not create egress network: ${result.stderr.trim()}`);
      }
    }
    if (!created) throw new Error('could not allocate an egress subnet');
    try {
      this.docker(['network', 'connect', '--alias', EGRESS_PROXY_NAME, network, EGRESS_PROXY_NAME]);
    } catch (err) {
      this.run(this.opts.dockerBinary, ['network', 'rm', network], {
        encoding: 'utf8',
        timeout: 30_000,
      });
      throw err;
    }

    const token = signGrant(this.secret, {
      hosts,
      exp: Math.floor(this.now() / 1000) + ttlSeconds,
    });
    const url = `http://operari:${token}@${EGRESS_PROXY_NAME}:${PROXY_PORT}`;
    const env: Record<string, string> = {
      HTTP_PROXY: url,
      HTTPS_PROXY: url,
      http_proxy: url,
      https_proxy: url,
      NO_PROXY: 'localhost,127.0.0.1',
      no_proxy: 'localhost,127.0.0.1',
    };
    let released = false;
    return {
      network,
      env,
      release: () => {
        if (released) return;
        released = true;
        const opts = { encoding: 'utf8' as const, timeout: 30_000 };
        this.run(
          this.opts.dockerBinary,
          ['network', 'disconnect', '-f', network, EGRESS_PROXY_NAME],
          opts
        );
        this.run(this.opts.dockerBinary, ['network', 'rm', network], opts);
      },
    };
  }
}

/** Egress networks left by a previous process; their sandboxes were killed by killOrphans. */
export function removeOrphanEgressNetworks(
  dockerBinary: string,
  spawnSync: SpawnSync = nodeSpawnSync as unknown as SpawnSync
): number {
  const ls = spawnSync(
    dockerBinary,
    ['network', 'ls', '-q', '--filter', `label=${EGRESS_LABEL}=sandbox`],
    { encoding: 'utf8', timeout: 30_000 }
  );
  if (ls.status !== 0) return 0;
  const ids = ls.stdout
    .split('\n')
    .map(s => s.trim())
    .filter(Boolean);
  for (const id of ids) {
    spawnSync(dockerBinary, ['network', 'disconnect', '-f', id, EGRESS_PROXY_NAME], {
      encoding: 'utf8',
      timeout: 30_000,
    });
    spawnSync(dockerBinary, ['network', 'rm', id], { encoding: 'utf8', timeout: 30_000 });
  }
  return ids.length;
}
