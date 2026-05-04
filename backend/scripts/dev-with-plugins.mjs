#!/usr/bin/env node
/**
 * Dev runner with live plugin reload.
 *
 * Wraps `ts-node-dev` so that when OPERARI_PLUGINS_DIR is set, edits
 * to plugin files outside `src/` also trigger a respawn. Without this
 * the loader only re-runs on src/ changes, so the dev loop for plugin
 * authors was "save → restart backend by hand".
 *
 * Why a script and not a one-liner in package.json:
 *   - The plugins dir is conditional. We don't want to add a phantom
 *     `--watch` arg when the env var isn't set, otherwise ts-node-dev
 *     prints a confusing "watch path not found" warning.
 *   - We accept either an absolute or repo-relative path. Resolving
 *     in a script is clearer than embedding shell-portable path math.
 *   - We log a single line up front so the operator knows whether
 *     the watcher is on or off (silence is the worst diagnostic).
 *
 * Usage: `node scripts/dev-with-plugins.mjs` (driven by `npm run dev`).
 */

import { spawn } from 'node:child_process';
import { existsSync, statSync } from 'node:fs';
import { resolve } from 'node:path';

const here = new URL('.', import.meta.url).pathname;
const backendRoot = resolve(here, '..');

const args = ['--respawn', '--transpile-only'];

const pluginsDir = process.env.OPERARI_PLUGINS_DIR;
if (pluginsDir) {
  const abs = resolve(pluginsDir);
  if (existsSync(abs) && statSync(abs).isDirectory()) {
    args.push('--watch', abs);
    console.log(`[dev] watching plugins dir for live reload: ${abs}`);
  } else {
    console.warn(
      `[dev] OPERARI_PLUGINS_DIR is set (${pluginsDir}) but does not exist or is not a directory — plugin watch disabled`
    );
  }
} else {
  console.log('[dev] OPERARI_PLUGINS_DIR not set — plugin watch disabled');
}

args.push('src/server.ts');

const child = spawn('ts-node-dev', args, {
  cwd: backendRoot,
  stdio: 'inherit',
  env: process.env,
});

child.on('exit', code => {
  process.exit(code ?? 1);
});

for (const sig of ['SIGINT', 'SIGTERM']) {
  process.on(sig, () => child.kill(sig));
}
