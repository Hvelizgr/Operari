import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { installPluginWatcher } from '../../../runbook/plugins/hot-reload';
import { getLivePlugin, installLivePlugins } from '../../../runbook/plugins/live-registry';
import * as loaderModule from '../../../runbook/plugins/loader';

// Fake prisma — only nodeType.upsert is reachable, and only when
// the loader emits non-empty manifests. Our mocked loader returns
// no manifests, so this stays untouched.
const fakePrisma = { nodeType: { upsert: jest.fn() } } as never;

describe('plugin hot-reload watcher', () => {
  let dir: string;
  // We mock loadPluginsSync so the test asserts the WATCHER's
  // contract (debounce → invalidate → swap → upsert) without depending
  // on Node's CJS require.cache, which Jest virtualises behind its
  // own module isolation. The real require.cache invalidation path
  // is exercised in production; here we prove the orchestration.
  const loadSpy = jest.spyOn(loaderModule, 'loadPluginsSync');

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'operari-plugin-hot-'));
    installLivePlugins([]);
    loadSpy.mockReset();
  });

  afterEach(() => {
    try {
      rmSync(dir, { recursive: true, force: true });
    } catch {
      // best-effort cleanup
    }
  });

  it('reloadNow re-runs the loader and swaps the live executor', async () => {
    // Need a real-looking dir so installPluginWatcher passes its
    // existsSync gate and fs.watch attaches without error.
    mkdirSync(join(dir, 'placeholder'));

    const v1 = {
      type: 'test.hot',
      execute: async () => ({ success: true, output: { tag: 'v1' } }),
    };
    const v2 = {
      type: 'test.hot',
      execute: async () => ({ success: true, output: { tag: 'v2' } }),
    };

    loadSpy.mockReturnValueOnce({
      executors: [v1],
      manifests: [],
      loaded: ['test.hot'],
      skipped: [],
    });

    const handle = installPluginWatcher({
      prisma: fakePrisma,
      pluginsDir: dir,
      registeredTypes: new Set(),
      debounceMs: 5,
    });
    expect(handle).not.toBeNull();

    try {
      await handle!.reloadNow();
      const r1 = await getLivePlugin('test.hot', undefined)!.execute({}, {} as never);
      expect((r1.output as { tag: string }).tag).toBe('v1');

      // Second reload: loader returns the v2 executor; the live
      // registry should swap to it without bringing v1 along.
      loadSpy.mockReturnValueOnce({
        executors: [v2],
        manifests: [],
        loaded: ['test.hot'],
        skipped: [],
      });
      await handle!.reloadNow();
      const r2 = await getLivePlugin('test.hot', undefined)!.execute({}, {} as never);
      expect((r2.output as { tag: string }).tag).toBe('v2');

      // Loader was invoked twice — once per reloadNow call.
      expect(loadSpy).toHaveBeenCalledTimes(2);
    } finally {
      handle?.stop();
    }
  });

  it('a plugin that disappears between loads leaves the live registry empty', async () => {
    mkdirSync(join(dir, 'placeholder'));
    const a = {
      type: 'test.disappears',
      execute: async () => ({ success: true }),
    };
    loadSpy.mockReturnValueOnce({
      executors: [a],
      manifests: [],
      loaded: ['test.disappears'],
      skipped: [],
    });

    const handle = installPluginWatcher({
      prisma: fakePrisma,
      pluginsDir: dir,
      registeredTypes: new Set(),
      debounceMs: 5,
    });

    try {
      await handle!.reloadNow();
      expect(getLivePlugin('test.disappears', undefined)).toBeDefined();

      // Second load returns no executors — simulates the operator
      // deleting the plugin folder. Live registry should clear.
      loadSpy.mockReturnValueOnce({
        executors: [],
        manifests: [],
        loaded: [],
        skipped: [],
      });
      await handle!.reloadNow();
      expect(getLivePlugin('test.disappears', undefined)).toBeUndefined();
    } finally {
      handle?.stop();
    }
  });

  it('returns null when OPERARI_PLUGINS_DIR is unset and no override', () => {
    const prev = process.env.OPERARI_PLUGINS_DIR;
    delete process.env.OPERARI_PLUGINS_DIR;
    try {
      const handle = installPluginWatcher({
        prisma: fakePrisma,
        registeredTypes: new Set(),
      });
      expect(handle).toBeNull();
    } finally {
      if (prev) process.env.OPERARI_PLUGINS_DIR = prev;
    }
  });
});
