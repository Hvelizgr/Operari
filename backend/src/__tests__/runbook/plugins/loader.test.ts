import fs from 'fs';
import os from 'os';
import path from 'path';

import { loadPluginsSync } from '../../../runbook/plugins/loader';

/**
 * End-to-end-ish tests for the plugin loader. We create a real tmp
 * directory with real files and require() real .js — this is the only
 * way to catch shape/require bugs that pure in-memory mocks would miss.
 *
 * Each test scenario goes into its own subdirectory so a single bad
 * plugin doesn't poison the next case through the require cache.
 */

const RUN_ROOT = fs.mkdtempSync(path.join(os.tmpdir(), 'cairn-plugins-'));

function makePlugin(name: string, files: Record<string, string>): string {
  const dir = path.join(RUN_ROOT, name);
  fs.mkdirSync(dir, { recursive: true });
  for (const [rel, content] of Object.entries(files)) {
    const full = path.join(dir, rel);
    fs.mkdirSync(path.dirname(full), { recursive: true });
    fs.writeFileSync(full, content);
  }
  return path.dirname(dir);
}

describe('plugin loader', () => {
  afterAll(() => {
    fs.rmSync(RUN_ROOT, { recursive: true, force: true });
  });

  it('returns empty result when no plugins dir is configured', () => {
    const result = loadPluginsSync({ pluginsDir: undefined });
    expect(result.executors).toEqual([]);
    expect(result.loaded).toEqual([]);
  });

  it('returns empty result when the dir does not exist', () => {
    const result = loadPluginsSync({
      pluginsDir: path.join(RUN_ROOT, 'does-not-exist'),
    });
    expect(result.executors).toEqual([]);
  });

  it('loads a valid plugin with default export = descriptor', () => {
    const pluginsDir = makePlugin('case-valid/valid-plugin', {
      'package.json': JSON.stringify({
        name: 'valid-plugin',
        cairn: { steps: ['./index.js'] },
      }),
      'index.js': `
                module.exports = {
                    type: 'example.ok',
                    configSchema: { parse: (x) => x },
                    execute: async () => ({ success: true, output: { ok: true } }),
                };
            `,
    });

    const result = loadPluginsSync({ pluginsDir });
    expect(result.executors).toHaveLength(1);
    expect(result.executors[0].type).toBe('example.ok');
    expect(result.loaded).toContain('valid-plugin:example.ok');
  });

  it('loads a plugin that uses ESM-style default export', () => {
    const pluginsDir = makePlugin('case-esm/esm-plugin', {
      'package.json': JSON.stringify({
        name: 'esm-plugin',
        cairn: { steps: ['./index.js'] },
      }),
      'index.js': `
                exports.default = {
                    type: 'example.esm',
                    configSchema: { parse: (x) => x },
                    execute: async () => ({ success: true }),
                };
            `,
    });

    const result = loadPluginsSync({ pluginsDir });
    expect(result.executors).toHaveLength(1);
    expect(result.executors[0].type).toBe('example.esm');
  });

  it('skips a dir with no package.json but keeps loading siblings', () => {
    const pluginsDir = makePlugin('case-mixed/good-plugin', {
      'package.json': JSON.stringify({
        name: 'good',
        cairn: { steps: ['./index.js'] },
      }),
      'index.js': `
                module.exports = {
                    type: 'example.mixed',
                    configSchema: { parse: (x) => x },
                    execute: async () => ({ success: true }),
                };
            `,
    });
    // Sibling dir with no manifest
    fs.mkdirSync(path.join(pluginsDir, 'orphan'), { recursive: true });
    fs.writeFileSync(path.join(pluginsDir, 'orphan', 'random.txt'), 'hi');

    const result = loadPluginsSync({ pluginsDir });
    expect(result.executors.map(e => e.type)).toEqual(['example.mixed']);
    expect(result.skipped).toContain('orphan');
  });

  it('rejects a plugin that claims a reserved type', () => {
    const pluginsDir = makePlugin('case-reserved/evil-plugin', {
      'package.json': JSON.stringify({
        name: 'evil',
        cairn: { steps: ['./index.js'] },
      }),
      'index.js': `
                module.exports = {
                    type: 'shell',
                    configSchema: { parse: (x) => x },
                    execute: async () => ({ success: true }),
                };
            `,
    });

    const result = loadPluginsSync({ pluginsDir });
    expect(result.executors).toHaveLength(0);
    expect(result.skipped.length).toBeGreaterThan(0);
  });

  it('rejects a plugin that claims a nanorun.* prefix', () => {
    const pluginsDir = makePlugin('case-prefix/prefix-plugin', {
      'package.json': JSON.stringify({
        name: 'sneaky',
        cairn: { steps: ['./index.js'] },
      }),
      'index.js': `
                module.exports = {
                    type: 'nanorun.fakeStep',
                    configSchema: { parse: (x) => x },
                    execute: async () => ({ success: true }),
                };
            `,
    });

    const result = loadPluginsSync({ pluginsDir });
    expect(result.executors).toHaveLength(0);
  });

  it('skips plugins with malformed default export', () => {
    const pluginsDir = makePlugin('case-bad-shape/bad-shape', {
      'package.json': JSON.stringify({
        name: 'bad-shape',
        cairn: { steps: ['./index.js'] },
      }),
      'index.js': `module.exports = { type: 'example.broken' };`, // missing configSchema, execute
    });

    const result = loadPluginsSync({ pluginsDir });
    expect(result.executors).toHaveLength(0);
  });

  it('skips plugins whose require() throws', () => {
    const pluginsDir = makePlugin('case-throw/throws-plugin', {
      'package.json': JSON.stringify({
        name: 'throws',
        cairn: { steps: ['./index.js'] },
      }),
      'index.js': `throw new Error('boom at load time');`,
    });

    const result = loadPluginsSync({ pluginsDir });
    expect(result.executors).toHaveLength(0);
  });

  it('skips a plugin colliding with an already-registered type (first wins)', () => {
    const pluginsDir = makePlugin('case-collision/collide-plugin', {
      'package.json': JSON.stringify({
        name: 'collide',
        cairn: { steps: ['./index.js'] },
      }),
      'index.js': `
                module.exports = {
                    type: 'example.already-taken',
                    configSchema: { parse: (x) => x },
                    execute: async () => ({ success: true }),
                };
            `,
    });

    const result = loadPluginsSync({
      pluginsDir,
      registeredTypes: new Set(['example.already-taken']),
    });
    expect(result.executors).toHaveLength(0);
  });

  it('accepts a plugin using the `nanorun.steps` manifest key', () => {
    // Both `nanorun.steps` (canonical, current) and `cairn.steps`
    // (legacy, from the intermediate rebrand era) are accepted so
    // in-flight plugins don't break on upgrade.
    const pluginsDir = makePlugin('case-legacy/legacy-key', {
      'package.json': JSON.stringify({
        name: 'legacy',
        nanorun: { steps: ['./index.js'] },
      }),
      'index.js': `
                module.exports = {
                    type: 'example.legacy',
                    configSchema: { parse: (x) => x },
                    execute: async () => ({ success: true }),
                };
            `,
    });

    const result = loadPluginsSync({ pluginsDir });
    expect(result.executors.map(e => e.type)).toContain('example.legacy');
  });

  it('invokes execute through the adapter and catches throws', async () => {
    const pluginsDir = makePlugin('case-execute/runtime-plugin', {
      'package.json': JSON.stringify({
        name: 'runtime',
        cairn: { steps: ['./index.js'] },
      }),
      'index.js': `
                module.exports = {
                    type: 'example.runtime',
                    configSchema: {
                        parse: (input) => {
                            if (input.bad) throw new Error('validation failed');
                            return input;
                        },
                    },
                    execute: async (config, ctx) => {
                        if (config.throw) throw new Error('kaboom');
                        ctx.emit({ type: 'log', text: 'running' });
                        return { success: true, output: { echoed: config.name } };
                    },
                };
            `,
    });

    const { executors } = loadPluginsSync({ pluginsDir });
    expect(executors).toHaveLength(1);
    const executor = executors[0];

    const happyCtx = {
      runId: 'r1',
      stepId: 's1',
      tenantId: 't1',
      variables: {},
      previousOutputs: {},
      secrets: {},
      emit: jest.fn(),
    };
    const happy = await executor.execute({ name: 'world' }, happyCtx);
    expect(happy.success).toBe(true);
    expect(happy.output).toEqual({ echoed: 'world' });
    expect(happyCtx.emit).toHaveBeenCalled();

    const invalid = await executor.execute({ bad: true }, happyCtx);
    expect(invalid.success).toBe(false);
    expect(invalid.error).toMatch(/invalid config/);

    const thrown = await executor.execute({ throw: true }, happyCtx);
    expect(thrown.success).toBe(false);
    expect(thrown.error).toMatch(/kaboom/);
  });
});
