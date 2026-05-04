'use client';

import { Network, Filter, Group, Anchor } from 'lucide-react';

import { useLineagePrefs } from '@/lib/userPrefs';

import { Toggle } from './userPrefsPrimitives';

const STRINGS = {
  en: {
    title: 'Runbook lineage',
    subtitle: 'Filter + grouping defaults applied to /lineage.',
    groupByCategoryLabel: 'Group by category',
    groupByCategoryHint:
      'Cluster runbooks visually by their `category` column. Off = single graph.',
    hideOnErrorLabel: 'Hide on-error edges',
    hideOnErrorHint: 'Only show explicit `runbook` step calls. Hides the orange on-error handlers.',
    hideHookLabel: 'Hide step hook edges',
    hideHookHint:
      'Hide per-step onSuccess / onFailure hook edges (emerald + red). Keeps the call graph clean when many steps wire hooks.',
    on: 'On',
    off: 'Off',
  },
  es: {
    title: 'Lineage de runbooks',
    subtitle: 'Filtro + agrupamiento por defecto en /lineage.',
    groupByCategoryLabel: 'Agrupar por categoría',
    groupByCategoryHint:
      'Cluster visual por la columna `category` de cada runbook. Apagado = grafo único.',
    hideOnErrorLabel: 'Ocultar handlers on-error',
    hideOnErrorHint:
      'Solo mostrar llamadas explícitas via step `runbook`. Oculta los handlers on-error en naranja.',
    hideHookLabel: 'Ocultar edges de hooks',
    hideHookHint:
      'Oculta los edges de hooks onSuccess / onFailure (verde + rojo) por step. Útil cuando muchos steps cablearon hooks.',
    on: 'Encendido',
    off: 'Apagado',
  },
} as const;

export default function LineagePrefsPanel({ lang }: { lang: 'en' | 'es' }) {
  const t = STRINGS[lang];
  const [prefs, setPrefs] = useLineagePrefs();

  return (
    <section className="rounded-lg border border-[var(--panel-border)] bg-[var(--panel-bg)] p-4">
      <header className="mb-3 flex items-center gap-2">
        <Network size={16} className="text-emerald-400" />
        <h2 className="text-sm font-semibold">{t.title}</h2>
      </header>
      <p className="mb-4 text-xs text-[var(--text-muted)]">{t.subtitle}</p>

      <div className="space-y-3">
        <Toggle
          icon={<Group size={12} />}
          label={t.groupByCategoryLabel}
          hint={t.groupByCategoryHint}
          value={prefs.groupByCategory}
          onChange={v => setPrefs({ groupByCategory: v })}
          on={t.on}
          off={t.off}
        />
        <Toggle
          icon={<Filter size={12} />}
          label={t.hideOnErrorLabel}
          hint={t.hideOnErrorHint}
          value={prefs.hideOnErrorEdges}
          onChange={v => setPrefs({ hideOnErrorEdges: v })}
          on={t.on}
          off={t.off}
        />
        <Toggle
          icon={<Anchor size={12} />}
          label={t.hideHookLabel}
          hint={t.hideHookHint}
          value={prefs.hideHookEdges}
          onChange={v => setPrefs({ hideHookEdges: v })}
          on={t.on}
          off={t.off}
        />
      </div>
    </section>
  );
}
