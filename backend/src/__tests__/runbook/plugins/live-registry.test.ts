import {
  getLivePlugin,
  installLivePlugins,
  liveRegistrySize,
} from '../../../runbook/plugins/live-registry';
import type { ExecutorContext, StepExecutor } from '../../../runbook/types/executor.types';

const noopExecute = async () => ({ success: true });

const makeExecutor = (type: string, tenantId?: string): StepExecutor => ({
  type,
  tenantId,
  execute: noopExecute,
});

describe('LivePluginRegistry', () => {
  beforeEach(() => {
    // Each test installs its own set; clear by installing empty.
    installLivePlugins([]);
  });

  it('replaces the entire set on install (clear-then-set)', () => {
    installLivePlugins([makeExecutor('a'), makeExecutor('b')]);
    expect(liveRegistrySize()).toBe(2);
    installLivePlugins([makeExecutor('c')]);
    expect(liveRegistrySize()).toBe(1);
    expect(getLivePlugin('a', undefined)).toBeUndefined();
    expect(getLivePlugin('c', undefined)?.type).toBe('c');
  });

  it('returns a global plugin when no tenant scope matches', () => {
    installLivePlugins([makeExecutor('shared.foo')]);
    expect(getLivePlugin('shared.foo', undefined)?.type).toBe('shared.foo');
    expect(getLivePlugin('shared.foo', 'tenant-x')?.type).toBe('shared.foo');
  });

  it('prefers a tenant-scoped plugin over the global with the same type', () => {
    const global = makeExecutor('shadowed.type');
    const tenantSpecific = makeExecutor('shadowed.type', 'tenant-x');
    installLivePlugins([global, tenantSpecific]);
    expect(getLivePlugin('shadowed.type', 'tenant-x')).toBe(tenantSpecific);
    expect(getLivePlugin('shadowed.type', 'tenant-y')).toBe(global);
    expect(getLivePlugin('shadowed.type', undefined)).toBe(global);
  });

  it('returns undefined for unknown types so the dispatcher falls back', () => {
    installLivePlugins([makeExecutor('only.this')]);
    expect(getLivePlugin('something.else', undefined)).toBeUndefined();
    expect(getLivePlugin('something.else', 'tenant-x')).toBeUndefined();
  });

  it('hot-swap: a refreshed install changes the executor returned for the same key', async () => {
    const v1 = makeExecutor('hot.target');
    const v2: StepExecutor = {
      type: 'hot.target',
      execute: async (_cfg: unknown, _ctx: ExecutorContext) => ({
        success: true,
        output: { version: 2 },
      }),
    };
    installLivePlugins([v1]);
    const before = getLivePlugin('hot.target', undefined);
    installLivePlugins([v2]);
    const after = getLivePlugin('hot.target', undefined);
    expect(before).toBe(v1);
    expect(after).toBe(v2);
    // Executing the post-swap reference returns the v2 output.
    const result = await after!.execute(
      {},
      { runId: 'r', stepId: 's', variables: {}, previousOutputs: {}, tenantId: 't' }
    );
    expect((result.output as { version: number }).version).toBe(2);
  });
});
