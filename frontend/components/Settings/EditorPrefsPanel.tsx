'use client';

import { Activity, FilePlus, Grid3x3, Save, Shield, Workflow } from 'lucide-react';

import { useEditorPrefs } from '@/lib/userPrefs';

import { NumberSlider, Pills, Toggle } from './userPrefsPrimitives';

const STRINGS = {
  en: {
    title: 'Runbook editor',
    subtitle: 'Defaults applied to /editor — autosave, snapping, deletion safety, layout.',
    autosaveLabel: 'Autosave interval',
    autosaveHint: 'Debounce window after edits before persisting to the backend.',
    confirmDeleteLabel: 'Confirm before delete',
    confirmDeleteHint:
      'Show a modal before Backspace / Delete removes nodes. On = safer, off = faster.',
    newNodePosLabel: 'Where new nodes drop',
    newNodePosHint: 'Position used when adding via search palette / right-click menu.',
    posCenter: 'Viewport center',
    posCursor: 'At cursor',
    posNext: 'Next to selected',
    snapLabel: 'Snap step',
    snapHint: 'Grid step size for drag positioning. 0 = no snap.',
    autoFitLabel: 'Auto fit-view on load',
    autoFitHint: 'When opening a runbook, zoom so every node is visible.',
    showStatsLabel: 'Show stats by default',
    showStatsHint:
      'Start every editor session with the run-history overlay turned on. Useful when reviewing failed runs.',
    on: 'On',
    off: 'Off',
  },
  es: {
    title: 'Editor de runbooks',
    subtitle: 'Defaults aplicados a /editor — autoguardado, snap, seguridad de borrado, layout.',
    autosaveLabel: 'Intervalo de autoguardado',
    autosaveHint: 'Ventana de debounce tras editar antes de persistir al backend.',
    confirmDeleteLabel: 'Confirmar antes de borrar',
    confirmDeleteHint:
      'Modal antes de que Backspace / Delete eliminen nodos. Encendido = seguro, apagado = rápido.',
    newNodePosLabel: 'Dónde aparecen los nodos nuevos',
    newNodePosHint: 'Posición usada al agregar desde la barra de búsqueda / right-click.',
    posCenter: 'Centro del viewport',
    posCursor: 'En el cursor',
    posNext: 'Junto al seleccionado',
    snapLabel: 'Step de snap',
    snapHint: 'Grilla del drag-positioning. 0 = sin snap.',
    autoFitLabel: 'Auto fit-view al cargar',
    autoFitHint: 'Al abrir un runbook, hace zoom para mostrar todos los nodos.',
    showStatsLabel: 'Mostrar stats por defecto',
    showStatsHint:
      'Cada sesión del editor arranca con el overlay de historial encendido. Útil para revisar runs fallidos.',
    on: 'Encendido',
    off: 'Apagado',
  },
} as const;

export default function EditorPrefsPanel({ lang }: { lang: 'en' | 'es' }) {
  const t = STRINGS[lang];
  const [prefs, setPrefs] = useEditorPrefs();

  return (
    <section className="rounded-lg border border-[var(--panel-border)] bg-[var(--panel-bg)] p-4">
      <header className="mb-3 flex items-center gap-2">
        <Workflow size={16} className="text-emerald-400" />
        <h2 className="text-sm font-semibold">{t.title}</h2>
      </header>
      <p className="mb-4 text-xs text-[var(--text-muted)]">{t.subtitle}</p>

      <div className="space-y-3">
        <NumberSlider
          icon={<Save size={12} />}
          label={t.autosaveLabel}
          hint={t.autosaveHint}
          value={prefs.autosaveIntervalMs}
          min={1000}
          max={10_000}
          step={500}
          format={n => `${(n / 1000).toFixed(1)}s`}
          onChange={n => setPrefs({ autosaveIntervalMs: n })}
        />
        <Toggle
          icon={<Shield size={12} />}
          label={t.confirmDeleteLabel}
          hint={t.confirmDeleteHint}
          value={prefs.confirmDelete}
          onChange={v => setPrefs({ confirmDelete: v })}
          on={t.on}
          off={t.off}
        />
        <Pills
          icon={<FilePlus size={12} />}
          label={t.newNodePosLabel}
          hint={t.newNodePosHint}
          value={prefs.newNodePosition}
          options={[
            { id: 'center', label: t.posCenter },
            { id: 'cursor', label: t.posCursor },
            { id: 'next-to-selected', label: t.posNext },
          ]}
          onChange={v => setPrefs({ newNodePosition: v })}
        />
        <Pills
          icon={<Grid3x3 size={12} />}
          label={t.snapLabel}
          hint={t.snapHint}
          value={prefs.snapStep}
          options={[
            { id: 0, label: 'Off' },
            { id: 10, label: '10px' },
            { id: 20, label: '20px' },
            { id: 40, label: '40px' },
          ]}
          onChange={v => setPrefs({ snapStep: v })}
        />
        <Toggle
          icon={<Workflow size={12} />}
          label={t.autoFitLabel}
          hint={t.autoFitHint}
          value={prefs.autoFitOnLoad}
          onChange={v => setPrefs({ autoFitOnLoad: v })}
          on={t.on}
          off={t.off}
        />
        <Toggle
          icon={<Activity size={12} />}
          label={t.showStatsLabel}
          hint={t.showStatsHint}
          value={prefs.showStatsByDefault}
          onChange={v => setPrefs({ showStatsByDefault: v })}
          on={t.on}
          off={t.off}
        />
      </div>
    </section>
  );
}
