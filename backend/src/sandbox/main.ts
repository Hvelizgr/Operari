/**
 * sandbox-runner entrypoint: `node dist/sandbox/main.js`.
 *
 * Runs next to a rootless Docker daemon (DOCKER_HOST) and is the only
 * process that talks to it; the backend reaches this service over HTTP with
 * a shared token and never gets a Docker socket. Deployment:
 * deploy/sandbox/README.md.
 */
import { chmodSync, existsSync, unlinkSync } from 'fs';

import { DEFAULT_SANDBOX_NETWORK } from '../runbook/runners/sandbox-profile';
import type { PtySpawn } from '../terminal/terminal-session';
import { DockerEgressController, removeOrphanEgressNetworks } from './egress-controller';
import { killOrphans, prefetchImages } from './housekeeping';
import { createSandboxServer } from './server';
import { prepareWorkspaceVolume } from './terminal-args';

function list(value: string | undefined): string[] {
  return (value ?? '')
    .split(',')
    .map(s => s.trim())
    .filter(Boolean);
}

const env = process.env;
const token = env.OPERARI_SANDBOX_TOKEN ?? '';
const images = list(env.OPERARI_SANDBOX_IMAGES);

const dockerBinary = env.DOCKER_BINARY || 'docker';
const allowedImages = images.length ? images : ['alpine:3.20'];
const orphans = killOrphans(dockerBinary);
if (orphans.length) console.warn(`killed ${orphans.length} container(s) left by a previous run`);
prefetchImages(
  dockerBinary,
  [...allowedImages, env.OPERARI_SANDBOX_TERMINAL_IMAGE || ''].filter(Boolean)
);

removeOrphanEgressNetworks(dockerBinary);

const sandboxNetwork = env.OPERARI_SANDBOX_NETWORK || DEFAULT_SANDBOX_NETWORK;
let egress: DockerEgressController | undefined;
if (env.OPERARI_SANDBOX_EGRESS !== 'off') {
  const controller = new DockerEgressController({
    dockerBinary,
    upstreamNetwork: sandboxNetwork,
    proxyImage: env.OPERARI_SANDBOX_EGRESS_IMAGE || undefined,
    runtime: env.OPERARI_SANDBOX_RUNTIME || undefined,
  });
  try {
    controller.start();
    egress = controller;
    console.warn('egress proxy started; allowlist sandboxes enabled');
  } catch (err) {
    console.error(
      `egress proxy unavailable, allowlist sandboxes refused: ${(err as Error).message}`
    );
  }
}

const server = createSandboxServer({
  token,
  images: allowedImages,
  terminalImage: env.OPERARI_SANDBOX_TERMINAL_IMAGE || undefined,
  network: sandboxNetwork,
  egress,
  runtime: env.OPERARI_SANDBOX_RUNTIME || undefined,
  dockerBinary,
  maxTerminals: env.OPERARI_SANDBOX_MAX_TERMINALS
    ? Number(env.OPERARI_SANDBOX_MAX_TERMINALS)
    : undefined,
  maxRuns: env.OPERARI_SANDBOX_MAX_RUNS ? Number(env.OPERARI_SANDBOX_MAX_RUNS) : undefined,
  spawnPty: (require('node-pty') as { spawn: PtySpawn }).spawn,
  prepareVolume: prepareWorkspaceVolume,
});

const listen = env.OPERARI_SANDBOX_LISTEN || '0.0.0.0:4100';
if (listen.startsWith('/')) {
  if (existsSync(listen)) unlinkSync(listen);
  server.listen(listen, () => {
    chmodSync(listen, 0o660);
    console.warn(`sandbox-runner listening on ${listen}`);
  });
} else {
  const idx = listen.lastIndexOf(':');
  const host = listen.slice(0, idx);
  const port = Number(listen.slice(idx + 1));
  server.listen(port, host, () => console.warn(`sandbox-runner listening on ${listen}`));
}

for (const signal of ['SIGTERM', 'SIGINT'] as const) {
  process.on(signal, () => {
    server.closeTerminals();
    server.close(() => process.exit(0));
    server.closeAllConnections();
  });
}
