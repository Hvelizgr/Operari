/**
 * Machine presets (trigger.dev parity).
 *
 * Operators authoring runbooks rarely know the exact memoryMb /
 * cpuMillis they need — they know "this step processes a small
 * payload" or "this step needs to crunch a 100MB CSV". Presets
 * abstract the raw numbers behind a small named menu so the
 * runbook YAML reads `machine: small-2x` instead of
 * `resources: { memoryMb: 1024, cpuMillis: 1000 }`.
 *
 * The preset names mirror trigger.dev's. Their cost ladder reads
 * from cheap → expensive (micro → large-2x) and operators learn
 * the shape quickly: `1x` is single-core; `2x` is dual; `small`
 * vs `medium` vs `large` is the memory band.
 *
 * Resolution order in `resolveMachineResources`:
 *   1. Explicit `resources` on the spec — wins, even if a preset
 *      is also set. (Authors who really know the numbers can pin.)
 *   2. `machine` preset name — looked up here.
 *   3. Fallback to `small-1x` (256 MB / 1 vCPU). Same default
 *      FlyMachineRunner shipped with v1.
 */

export const MACHINE_PRESET_NAMES = [
  'micro',
  'small-1x',
  'small-2x',
  'medium-1x',
  'medium-2x',
  'large-1x',
  'large-2x',
] as const;

export type MachinePresetName = (typeof MACHINE_PRESET_NAMES)[number];

export interface MachineResources {
  cpuMillis: number;
  memoryMb: number;
}

/**
 * The lookup table. Numbers chosen to be a strict superset of the
 * trigger.dev ladder so a tenant migrating from there sees no
 * regression in available bands. CPU is reported in millis (1000 =
 * 1 vCPU) to match the existing RunnerSpec shape.
 */
const PRESET_TABLE: Record<MachinePresetName, MachineResources> = {
  micro: { cpuMillis: 250, memoryMb: 128 },
  'small-1x': { cpuMillis: 1000, memoryMb: 256 },
  'small-2x': { cpuMillis: 2000, memoryMb: 512 },
  'medium-1x': { cpuMillis: 1000, memoryMb: 1024 },
  'medium-2x': { cpuMillis: 2000, memoryMb: 2048 },
  'large-1x': { cpuMillis: 1000, memoryMb: 4096 },
  'large-2x': { cpuMillis: 2000, memoryMb: 8192 },
};

export function isMachinePresetName(value: unknown): value is MachinePresetName {
  return typeof value === 'string' && (MACHINE_PRESET_NAMES as readonly string[]).includes(value);
}

/**
 * Look up a preset's raw resource numbers. Falls back to `small-1x`
 * for an unknown name so a typo never crashes the runner — the
 * preset name is also surfaced in the run log as a metadata field
 * so the operator can see what was used.
 */
export function machinePresetResources(name: MachinePresetName): MachineResources {
  return PRESET_TABLE[name] ?? PRESET_TABLE['small-1x'];
}

/**
 * Resolve the effective {cpu, memory} for a runner spec given its
 * declared `machine` preset, any explicit `resources` override, and
 * an optional tenant-wide default.
 *
 * Resolution order (first non-null wins):
 *   1. spec.resources.{cpuMillis,memoryMb} — explicit numbers, per-key
 *   2. spec.machine preset
 *   3. tenantDefaultMachine preset
 *   4. small-1x (engine fallback)
 *
 * Explicit numbers win per-key — operators that hand-tuned values
 * before the presets shipped should not see a regression.
 */
export function resolveMachineResources(
  spec: {
    machine?: string;
    resources?: { cpuMillis?: number; memoryMb?: number };
  },
  options?: { tenantDefaultMachine?: string | null }
): MachineResources {
  const tenantPreset =
    options?.tenantDefaultMachine && isMachinePresetName(options.tenantDefaultMachine)
      ? options.tenantDefaultMachine
      : null;
  const fromPreset = isMachinePresetName(spec.machine)
    ? machinePresetResources(spec.machine)
    : tenantPreset
      ? machinePresetResources(tenantPreset)
      : machinePresetResources('small-1x');
  return {
    cpuMillis: spec.resources?.cpuMillis ?? fromPreset.cpuMillis,
    memoryMb: spec.resources?.memoryMb ?? fromPreset.memoryMb,
  };
}
