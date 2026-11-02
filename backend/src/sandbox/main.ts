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

const server = createSandboxServer({
  token,
  images: images.length ? images : ['alpine:3.20'],
  terminalImage: env.OPERARI_SANDBOX_TERMINAL_IMAGE || undefined,
  network: env.OPERARI_SANDBOX_NETWORK || DEFAULT_SANDBOX_NETWORK,
  runtime: env.OPERARI_SANDBOX_RUNTIME || undefined,
  dockerBinary: env.DOCKER_BINARY || undefined,
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
