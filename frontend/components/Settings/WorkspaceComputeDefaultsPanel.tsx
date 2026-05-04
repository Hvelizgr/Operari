'use client';

import { Building2, Check, Cpu, Loader2 } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';

import { useAuth } from '@/lib/auth';
import { type MachinePresetName } from '@/lib/userPrefs';

import { NumberSlider, Pills, Toggle } from './userPrefsPrimitives';

/**
 * Workspace-wide compute defaults — admin-gated, DB-backed.
 *
 * Distinct from ComputePrefsPanel (per-device localStorage prefs):
 *   - This panel writes to Tenant.computeDefaults via PATCH
 *     /api/tenants/compute-defaults
 *   - The trigger entry points (v1/runbooks/.../trigger and the
 *     editor manual-run route) read these as the fallback when
 *     neither the request payload nor the runbook spec supplies an
 *     explicit value.
 *   - Members can read; only ADMIN can write.
 */

interface ComputeDefaults {
  machine?: MachinePresetName | null;
  ttlSeconds?: number | null;
  retryCount?: number | null;
  dryRun?: boolean | null;
}

const STRINGS = {
  en: {
    title: 'Workspace compute defaults',
    subtitle:
      'Applied at trigger time when neither the payload nor the runbook spec sets a value. Admin-only writes.',
    machineLabel: 'Default machine preset',
    machineHint: 'Used when a step has no explicit `machine` and the runbook has no default.',
    ttlLabel: 'Default TTL (seconds)',
    ttlHint: '0 = no TTL fallback. Triggers can still set their own.',
    dryRunLabel: 'Default to dry-run',
    dryRunHint:
      'Triggers without an explicit `dryRun` field land in dry-run. Triggers explicitly setting `dryRun: false` still run live.',
    save: 'Save workspace defaults',
    saved: 'Saved',
    saving: 'Saving…',
    readOnly: 'Read-only — only admins can change workspace defaults.',
    on: 'On',
    off: 'Off',
  },
  es: {
    title: 'Defaults de cómputo del workspace',
    subtitle:
      'Aplicados al disparar cuando ni el payload ni el spec del runbook especifican un valor. Solo admins pueden escribir.',
    machineLabel: 'Preset de máquina por defecto',
    machineHint: 'Usado cuando un step no tiene `machine` explícito y el runbook no tiene default.',
    ttlLabel: 'TTL por defecto (segundos)',
    ttlHint: '0 = sin TTL fallback. Los triggers pueden setear el suyo.',
    dryRunLabel: 'Dry-run por defecto',
    dryRunHint:
      'Los triggers sin `dryRun` explícito caen en dry-run. Los que pasen `dryRun: false` corren en vivo igual.',
    save: 'Guardar defaults',
    saved: 'Guardado',
    saving: 'Guardando…',
    readOnly: 'Solo lectura — solo admins pueden cambiar los defaults del workspace.',
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

export default function WorkspaceComputeDefaultsPanel({ lang }: { lang: 'en' | 'es' }) {
  const t = STRINGS[lang];
  const apiBase = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';
  const { session } = useAuth();
  const isAdmin = session?.user.role === 'ADMIN' || session?.user.role === 'OWNER';

  const [defaults, setDefaults] = useState<ComputeDefaults>({});
  const [saving, setSaving] = useState(false);
  const [savedFlash, setSavedFlash] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch(`${apiBase}/api/tenants/compute-defaults`);
      if (!res.ok) return;
      const json = (await res.json()) as { data: ComputeDefaults };
      setDefaults(json.data ?? {});
    } catch {
      // Quiet — panel renders with empty defaults if the read fails.
    }
  }, [apiBase]);

  useEffect(() => {
    void load();
  }, [load]);

  const save = async () => {
    if (!isAdmin || saving) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`${apiBase}/api/tenants/compute-defaults`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(defaults),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || `HTTP ${res.status}`);
      }
      setSavedFlash(true);
      setTimeout(() => setSavedFlash(false), 1500);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="rounded-lg border border-[var(--panel-border)] bg-[var(--panel-bg)] p-4">
      <header className="mb-3 flex items-center gap-2">
        <Building2 size={16} className="text-amber-400" />
        <h2 className="text-sm font-semibold">{t.title}</h2>
      </header>
      <p className="mb-4 text-xs text-[var(--text-muted)]">{t.subtitle}</p>

      {!isAdmin && (
        <div className="mb-3 rounded border border-zinc-800 bg-zinc-950 px-3 py-2 text-[11px] italic text-zinc-500">
          {t.readOnly}
        </div>
      )}

      <fieldset disabled={!isAdmin || saving} className="space-y-3 disabled:opacity-60">
        <Pills
          icon={<Cpu size={12} />}
          label={t.machineLabel}
          hint={t.machineHint}
          value={defaults.machine ?? 'small-1x'}
          options={MACHINE_OPTIONS}
          onChange={v => setDefaults(prev => ({ ...prev, machine: v }))}
        />
        <NumberSlider
          label={t.ttlLabel}
          hint={t.ttlHint}
          value={defaults.ttlSeconds ?? 0}
          min={0}
          max={86400}
          step={60}
          onChange={v => setDefaults(prev => ({ ...prev, ttlSeconds: v > 0 ? v : null }))}
        />
        <Toggle
          label={t.dryRunLabel}
          hint={t.dryRunHint}
          value={defaults.dryRun ?? false}
          onChange={v => setDefaults(prev => ({ ...prev, dryRun: v }))}
          on={t.on}
          off={t.off}
        />
      </fieldset>

      {error && (
        <div className="mt-3 rounded border border-red-900 bg-red-950/40 px-3 py-2 text-[11px] text-red-300">
          {error}
        </div>
      )}

      {isAdmin && (
        <div className="mt-4 flex items-center gap-2">
          <button
            onClick={save}
            disabled={saving}
            className="flex items-center gap-1.5 rounded border border-emerald-700 bg-emerald-900/40 px-3 py-1.5 text-[11px] font-medium text-emerald-300 transition-colors hover:bg-emerald-900/60 disabled:opacity-50"
          >
            {saving ? (
              <>
                <Loader2 size={12} className="animate-spin" />
                {t.saving}
              </>
            ) : savedFlash ? (
              <>
                <Check size={12} />
                {t.saved}
              </>
            ) : (
              t.save
            )}
          </button>
        </div>
      )}
    </section>
  );
}
