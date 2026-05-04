'use client';

import { Cpu, Clock, RotateCcw, FlaskConical } from 'lucide-react';

import { type MachinePresetName, useComputePrefs } from '@/lib/userPrefs';

import { NumberSlider, Pills, Toggle } from './userPrefsPrimitives';

const STRINGS = {
  en: {
    title: 'Compute defaults',
    subtitle:
      'Defaults seeded into the trigger dialog and new step forms. Per-runbook + per-step values override these.',
    machineLabel: 'Default machine preset',
    machineHint:
      'Cheap → expensive. Picks the resource band each step lands on when nothing else is set.',
    ttlLabel: 'Default TTL (seconds)',
    ttlHint: 'Auto-cancel deadline for new triggers. 0 = no TTL.',
    retryLabel: 'Default retry count',
    retryHint:
      'Number of additional attempts after the first failure. Per-step retry policies always win.',
    dryRunLabel: 'Default to dry-run',
    dryRunHint:
      'When on, the trigger dialog opens with dry-run pre-selected. Useful when most of your runbooks touch prod.',
    on: 'On',
    off: 'Off',
  },
  es: {
    title: 'Defaults de cómputo',
    subtitle:
      'Defaults pre-cargados en el diálogo de trigger y en formularios de nuevo step. Los valores por runbook y por step ganan.',
    machineLabel: 'Preset de máquina por defecto',
    machineHint:
      'Barato → caro. Define la banda de recursos que cada step recibe cuando no hay otro valor seteado.',
    ttlLabel: 'TTL por defecto (segundos)',
    ttlHint: 'Deadline de auto-cancelación para nuevos triggers. 0 = sin TTL.',
    retryLabel: 'Cantidad de retries por defecto',
    retryHint:
      'Número de reintentos después del primer fallo. Las políticas de retry por step siempre ganan.',
    dryRunLabel: 'Dry-run por defecto',
    dryRunHint:
      'Si está encendido, el diálogo de trigger abre con dry-run pre-seleccionado. Útil cuando la mayoría de runbooks tocan prod.',
    on: 'Encendido',
    off: 'Apagado',
  },
} as const;

const MACHINE_OPTIONS: Array<{ id: MachinePresetName; label: string }> = [
  { id: 'micro', label: 'micro · 128 MB' },
  { id: 'small-1x', label: 'small-1x · 256 MB' },
  { id: 'small-2x', label: 'small-2x · 512 MB' },
  { id: 'medium-1x', label: 'medium-1x · 1 GB' },
  { id: 'medium-2x', label: 'medium-2x · 2 GB' },
  { id: 'large-1x', label: 'large-1x · 4 GB' },
  { id: 'large-2x', label: 'large-2x · 8 GB' },
];

export default function ComputePrefsPanel({ lang }: { lang: 'en' | 'es' }) {
  const t = STRINGS[lang];
  const [prefs, setPrefs] = useComputePrefs();

  return (
    <section className="rounded-lg border border-[var(--panel-border)] bg-[var(--panel-bg)] p-4">
      <header className="mb-3 flex items-center gap-2">
        <Cpu size={16} className="text-emerald-400" />
        <h2 className="text-sm font-semibold">{t.title}</h2>
      </header>
      <p className="mb-4 text-xs text-[var(--text-muted)]">{t.subtitle}</p>

      <div className="space-y-3">
        <Pills
          icon={<Cpu size={12} />}
          label={t.machineLabel}
          hint={t.machineHint}
          value={prefs.defaultMachine}
          options={MACHINE_OPTIONS}
          onChange={v => setPrefs({ defaultMachine: v })}
        />
        <NumberSlider
          icon={<Clock size={12} />}
          label={t.ttlLabel}
          hint={t.ttlHint}
          value={prefs.defaultTtlSeconds}
          min={0}
          max={86400}
          step={60}
          onChange={v => setPrefs({ defaultTtlSeconds: v })}
        />
        <NumberSlider
          icon={<RotateCcw size={12} />}
          label={t.retryLabel}
          hint={t.retryHint}
          value={prefs.defaultRetryCount}
          min={0}
          max={10}
          step={1}
          onChange={v => setPrefs({ defaultRetryCount: v })}
        />
        <Toggle
          icon={<FlaskConical size={12} />}
          label={t.dryRunLabel}
          hint={t.dryRunHint}
          value={prefs.defaultDryRun}
          onChange={v => setPrefs({ defaultDryRun: v })}
          on={t.on}
          off={t.off}
        />
      </div>
    </section>
  );
}
