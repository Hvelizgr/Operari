import {
  isMachinePresetName,
  machinePresetResources,
  resolveMachineResources,
} from '../../../runbook/runners/machine-presets';

describe('isMachinePresetName', () => {
  it('accepts every documented preset name', () => {
    for (const name of [
      'micro',
      'small-1x',
      'small-2x',
      'medium-1x',
      'medium-2x',
      'large-1x',
      'large-2x',
    ]) {
      expect(isMachinePresetName(name)).toBe(true);
    }
  });

  it('rejects everything else', () => {
    expect(isMachinePresetName('xl')).toBe(false);
    expect(isMachinePresetName('')).toBe(false);
    expect(isMachinePresetName(null)).toBe(false);
    expect(isMachinePresetName(undefined)).toBe(false);
    expect(isMachinePresetName(12)).toBe(false);
  });
});

describe('machinePresetResources', () => {
  it('returns the documented numbers for each preset', () => {
    expect(machinePresetResources('micro')).toEqual({ cpuMillis: 250, memoryMb: 128 });
    expect(machinePresetResources('small-1x')).toEqual({ cpuMillis: 1000, memoryMb: 256 });
    expect(machinePresetResources('small-2x')).toEqual({ cpuMillis: 2000, memoryMb: 512 });
    expect(machinePresetResources('medium-1x')).toEqual({ cpuMillis: 1000, memoryMb: 1024 });
    expect(machinePresetResources('large-2x')).toEqual({ cpuMillis: 2000, memoryMb: 8192 });
  });
});

describe('resolveMachineResources', () => {
  it('uses small-1x when neither machine nor resources are set', () => {
    expect(resolveMachineResources({})).toEqual({ cpuMillis: 1000, memoryMb: 256 });
  });

  it('reads from the named preset when only machine is set', () => {
    expect(resolveMachineResources({ machine: 'medium-2x' })).toEqual({
      cpuMillis: 2000,
      memoryMb: 2048,
    });
  });

  it('falls back to small-1x for an unknown preset name (no throw)', () => {
    expect(resolveMachineResources({ machine: 'galactic-9x' })).toEqual({
      cpuMillis: 1000,
      memoryMb: 256,
    });
  });

  it('explicit resources win over the preset (per-key)', () => {
    // memory comes from the explicit resources, cpu from the preset.
    expect(
      resolveMachineResources({
        machine: 'large-2x',
        resources: { memoryMb: 6000 },
      })
    ).toEqual({ cpuMillis: 2000, memoryMb: 6000 });

    // and vice-versa.
    expect(
      resolveMachineResources({
        machine: 'large-2x',
        resources: { cpuMillis: 4000 },
      })
    ).toEqual({ cpuMillis: 4000, memoryMb: 8192 });
  });

  it('explicit resources without a machine still resolve cleanly', () => {
    expect(resolveMachineResources({ resources: { memoryMb: 768 } })).toEqual({
      cpuMillis: 1000,
      memoryMb: 768,
    });
  });

  describe('tenantDefaultMachine fallback', () => {
    it('uses the tenant default when spec has no machine and no resources', () => {
      expect(resolveMachineResources({}, { tenantDefaultMachine: 'medium-1x' })).toEqual({
        cpuMillis: 1000,
        memoryMb: 1024,
      });
    });

    it('spec.machine wins over tenant default (explicit beats workspace)', () => {
      expect(
        resolveMachineResources({ machine: 'large-2x' }, { tenantDefaultMachine: 'micro' })
      ).toEqual({ cpuMillis: 2000, memoryMb: 8192 });
    });

    it('explicit per-key resources still beat both spec.machine and the tenant default', () => {
      expect(
        resolveMachineResources(
          { machine: 'medium-2x', resources: { memoryMb: 512 } },
          { tenantDefaultMachine: 'large-1x' }
        )
      ).toEqual({ cpuMillis: 2000, memoryMb: 512 });
    });

    it('ignores an unknown tenant default name and falls back to small-1x', () => {
      expect(resolveMachineResources({}, { tenantDefaultMachine: 'galactic-9x' })).toEqual({
        cpuMillis: 1000,
        memoryMb: 256,
      });
    });

    it('null tenant default behaves identically to undefined', () => {
      expect(resolveMachineResources({}, { tenantDefaultMachine: null })).toEqual(
        resolveMachineResources({})
      );
    });
  });
});
