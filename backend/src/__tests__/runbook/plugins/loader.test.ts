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

const RUN_ROOT = fs.mkdtempSync(path.join(os.tmpdir(), 'operari-plugins-'));

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
        operari: { steps: ['./index.js'] },
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
        operari: { steps: ['./index.js'] },
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
        operari: { steps: ['./index.js'] },
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
        operari: { steps: ['./index.js'] },
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

  it('rejects a plugin that claims a operari.* prefix', () => {
    const pluginsDir = makePlugin('case-prefix/prefix-plugin', {
      'package.json': JSON.stringify({
        name: 'sneaky',
        operari: { steps: ['./index.js'] },
      }),
      'index.js': `
                module.exports = {
                    type: 'operari.fakeStep',
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
        operari: { steps: ['./index.js'] },
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
        operari: { steps: ['./index.js'] },
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
        operari: { steps: ['./index.js'] },
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

  it('accepts a plugin using the `operari.steps` manifest key', () => {
    // Both `operari.steps` (canonical, current) and `operari.steps`
    // (legacy, from the intermediate rebrand era) are accepted so
    // in-flight plugins don't break on upgrade.
    const pluginsDir = makePlugin('case-legacy/legacy-key', {
      'package.json': JSON.stringify({
        name: 'legacy',
        operari: { steps: ['./index.js'] },
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
        operari: { steps: ['./index.js'] },
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

  describe('manifest metadata extraction', () => {
    it('preserves visual + form metadata on the manifests array', () => {
      const pluginsDir = makePlugin('case-meta/with-meta', {
        'package.json': JSON.stringify({
          name: 'with-meta',
          operari: { steps: ['./index.js'] },
        }),
        'index.js': `
          module.exports = {
            type: 'example.with-meta',
            configSchema: { parse: (x) => x },
            execute: async () => ({ success: true }),
            label: { en: 'With meta', es: 'Con metadata' },
            description: 'A step that ships palette metadata',
            icon: 'Send',
            color: 'bg-pink-500',
            category: 'integrations',
            inputs: [{ name: 'main', type: 'main' }],
            outputs: [{ name: 'main', type: 'main' }],
            properties: [
              { name: 'msg', displayName: 'Message', type: 'string' },
            ],
          };
        `,
      });

      const result = loadPluginsSync({ pluginsDir });
      expect(result.executors).toHaveLength(1);
      expect(result.manifests).toHaveLength(1);
      const m = result.manifests[0];
      expect(m.type).toBe('example.with-meta');
      expect(m.icon).toBe('Send');
      expect(m.color).toBe('bg-pink-500');
      expect(m.category).toBe('integrations');
      expect(m.label).toEqual({ en: 'With meta', es: 'Con metadata' });
      expect(m.description).toBe('A step that ships palette metadata');
      expect(Array.isArray(m.inputs)).toBe(true);
      expect(Array.isArray(m.properties)).toBe(true);
      expect((m.properties as unknown[]).length).toBe(1);
    });

    it('emits a manifest with undefined fields when the plugin omits metadata', () => {
      const pluginsDir = makePlugin('case-meta-bare/bare-meta', {
        'package.json': JSON.stringify({
          name: 'bare-meta',
          operari: { steps: ['./index.js'] },
        }),
        'index.js': `
          module.exports = {
            type: 'example.bare-meta',
            configSchema: { parse: (x) => x },
            execute: async () => ({ success: true }),
          };
        `,
      });

      const result = loadPluginsSync({ pluginsDir });
      expect(result.manifests).toHaveLength(1);
      const m = result.manifests[0];
      expect(m.type).toBe('example.bare-meta');
      expect(m.icon).toBeUndefined();
      expect(m.label).toBeUndefined();
      expect(m.properties).toBeUndefined();
    });

    it('drops malformed metadata fields without dropping the executor', () => {
      // A plugin that ships icon as a number or properties as a
      // non-array should still load — the runtime contract is what
      // matters; the editor gracefully falls back to defaults.
      const pluginsDir = makePlugin('case-meta-bad/bad-meta', {
        'package.json': JSON.stringify({
          name: 'bad-meta',
          operari: { steps: ['./index.js'] },
        }),
        'index.js': `
          module.exports = {
            type: 'example.bad-meta',
            configSchema: { parse: (x) => x },
            execute: async () => ({ success: true }),
            icon: 42,
            properties: 'not-an-array',
          };
        `,
      });

      const result = loadPluginsSync({ pluginsDir });
      expect(result.executors).toHaveLength(1);
      expect(result.manifests).toHaveLength(1);
      const m = result.manifests[0];
      expect(m.icon).toBeUndefined();
      expect(m.properties).toBeUndefined();
    });
  });

  describe('python plugin discovery (operari.json)', () => {
    it('loads a python plugin declared via operari.json language=python', () => {
      const pluginsDir = makePlugin('case-python-ok/py-plugin', {
        'operari.json': JSON.stringify({
          type: 'example.python-ok',
          language: 'python',
          entry: 'step.py',
          icon: 'MessageSquare',
          color: 'bg-emerald-500',
          category: 'custom',
          label: { en: 'Hello python', es: 'Hola python' },
          properties: [{ name: 'name', displayName: 'Name', type: 'string' }],
        }),
        // The script does not need to be runnable for the loader test;
        // we are pinning that the loader builds an executor without
        // ever spawning a subprocess. The executor's spawn happens at
        // run() time, not at load time.
        'step.py': '# placeholder\n',
      });

      const result = loadPluginsSync({ pluginsDir });
      expect(result.executors).toHaveLength(1);
      expect(result.executors[0].type).toBe('example.python-ok');
      expect(result.manifests).toHaveLength(1);
      expect(result.manifests[0]).toMatchObject({
        type: 'example.python-ok',
        icon: 'MessageSquare',
        category: 'custom',
        label: { en: 'Hello python', es: 'Hola python' },
      });
      expect(Array.isArray(result.manifests[0].properties)).toBe(true);
    });

    it('skips a python plugin whose entry script is missing', () => {
      const pluginsDir = makePlugin('case-python-missing-entry/no-script', {
        'operari.json': JSON.stringify({
          type: 'example.python-missing',
          language: 'python',
          entry: 'does_not_exist.py',
        }),
      });
      const result = loadPluginsSync({ pluginsDir });
      expect(result.executors).toHaveLength(0);
      expect(result.skipped.some(s => s.includes('no-script'))).toBe(true);
    });

    it('rejects a python plugin that claims a reserved type', () => {
      const pluginsDir = makePlugin('case-python-reserved/reserved', {
        'operari.json': JSON.stringify({
          type: 'shell',
          language: 'python',
          entry: 'step.py',
        }),
        'step.py': '# placeholder\n',
      });
      const result = loadPluginsSync({ pluginsDir });
      expect(result.executors).toHaveLength(0);
    });

    it('skips operari.json without language: skips python branch (falls through to package.json)', () => {
      // No package.json fallback either → plugin is skipped entirely.
      const pluginsDir = makePlugin('case-python-no-language/needs-lang', {
        'operari.json': JSON.stringify({
          type: 'example.no-language',
          entry: 'step.py',
        }),
        'step.py': '# placeholder\n',
      });
      const result = loadPluginsSync({ pluginsDir });
      expect(result.executors).toHaveLength(0);
    });
  });

  describe('tenant-scoped plugin discovery (ADR 0006)', () => {
    function makeTenantPlugin(
      caseDir: string,
      tenantId: string,
      pluginName: string,
      files: Record<string, string>
    ): string {
      const root = path.join(RUN_ROOT, caseDir);
      fs.mkdirSync(root, { recursive: true });
      const tenantsRoot = path.join(root, 'tenants', tenantId);
      const pluginRoot = path.join(tenantsRoot, pluginName);
      fs.mkdirSync(pluginRoot, { recursive: true });
      for (const [rel, content] of Object.entries(files)) {
        const full = path.join(pluginRoot, rel);
        fs.mkdirSync(path.dirname(full), { recursive: true });
        fs.writeFileSync(full, content);
      }
      return root;
    }

    it('loads a tenant-scoped plugin from <root>/tenants/<id>/<plugin>/', () => {
      const pluginsDir = makeTenantPlugin('case-tenant-load', 'tenant-A', 'acme-foo', {
        'package.json': JSON.stringify({
          name: 'acme-foo',
          operari: { steps: ['./index.js'] },
        }),
        'index.js': `
          module.exports = {
            type: 'acme.foo',
            configSchema: { parse: (x) => x },
            execute: async () => ({ success: true, output: { who: 'tenant-A' } }),
          };
        `,
      });

      const result = loadPluginsSync({ pluginsDir });
      expect(result.executors).toHaveLength(1);
      expect(result.executors[0].type).toBe('acme.foo');
      expect(result.executors[0].tenantId).toBe('tenant-A');
      expect(result.manifests[0].tenantId).toBe('tenant-A');
      expect(result.loaded[0]).toContain('[tenant=tenant-A]');
    });

    it('lets two tenants both claim the same type without colliding', () => {
      // Build a plugins root that has globals/, tenants/A/, tenants/B/
      // each shipping a plugin with type "acme.foo" — three live
      // executors are loaded with three distinct dup-keys.
      const root = path.join(RUN_ROOT, 'case-tenant-collide');
      fs.mkdirSync(root, { recursive: true });

      const writePlugin = (dir: string, output: string) => {
        fs.mkdirSync(dir, { recursive: true });
        fs.writeFileSync(
          path.join(dir, 'package.json'),
          JSON.stringify({ name: path.basename(dir), operari: { steps: ['./index.js'] } })
        );
        fs.writeFileSync(
          path.join(dir, 'index.js'),
          `module.exports = {
            type: 'acme.foo',
            configSchema: { parse: (x) => x },
            execute: async () => ({ success: true, output: { who: '${output}' } }),
          };`
        );
      };

      writePlugin(path.join(root, 'global-version'), 'global');
      writePlugin(path.join(root, 'tenants', 'tenant-A', 'a-version'), 'A');
      writePlugin(path.join(root, 'tenants', 'tenant-B', 'b-version'), 'B');

      const result = loadPluginsSync({ pluginsDir: root });

      expect(result.executors).toHaveLength(3);
      const byTenant = new Map<string | undefined, (typeof result.executors)[number]>();
      for (const ex of result.executors) byTenant.set(ex.tenantId, ex);
      expect(byTenant.get(undefined)?.type).toBe('acme.foo');
      expect(byTenant.get('tenant-A')?.type).toBe('acme.foo');
      expect(byTenant.get('tenant-B')?.type).toBe('acme.foo');
    });

    it('tags python plugins discovered under tenants/<id>/ with the right tenantId', () => {
      const pluginsDir = makeTenantPlugin('case-tenant-python', 'tenant-X', 'py-step', {
        'operari.json': JSON.stringify({
          type: 'acme.python-only',
          language: 'python',
          entry: 'step.py',
          icon: 'MessageSquare',
        }),
        'step.py': '# placeholder\n',
      });

      const result = loadPluginsSync({ pluginsDir });
      expect(result.executors).toHaveLength(1);
      expect(result.executors[0].tenantId).toBe('tenant-X');
      expect(result.manifests[0].tenantId).toBe('tenant-X');
    });

    it('a tenant-scoped plugin still cannot claim a reserved type', () => {
      const pluginsDir = makeTenantPlugin('case-tenant-reserved', 'tenant-A', 'bad', {
        'package.json': JSON.stringify({
          name: 'bad',
          operari: { steps: ['./index.js'] },
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
    });
  });
});
