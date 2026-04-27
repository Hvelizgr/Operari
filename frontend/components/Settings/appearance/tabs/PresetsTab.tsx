'use client';

import { Download, Eye, LayoutDashboard, RotateCcw, Save, Trash2, Upload } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

import { ACCENT_HEX, useVisualization } from '@/context/VisualizationContext';

import {
  BUILTIN_PRESETS,
  type CustomPreset,
  extractPrefs,
  loadCustomPresets,
  MAX_CUSTOM_PRESETS,
  saveCustomPresets,
} from '../presets';
import { PresetCard, Section } from '../primitives';
import type { Strings } from '../strings';

export function PresetsTab({ t }: { t: Strings }) {
  const viz = useVisualization();
  const [customPresets, setCustomPresets] = useState<CustomPreset[]>([]);
  const [newName, setNewName] = useState('');
  const [capError, setCapError] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setCustomPresets(loadCustomPresets());
  }, []);

  const saveCurrentAsPreset = () => {
    const name = newName.trim();
    if (!name) return;
    if (customPresets.length >= MAX_CUSTOM_PRESETS) {
      setCapError(true);
      return;
    }
    const preset: CustomPreset = {
      id: `custom-${Date.now()}`,
      name,
      patch: extractPrefs(viz),
    };
    const next = [...customPresets, preset];
    setCustomPresets(next);
    saveCustomPresets(next);
    setNewName('');
    setCapError(false);
  };

  const deletePreset = (id: string) => {
    const next = customPresets.filter(p => p.id !== id);
    setCustomPresets(next);
    saveCustomPresets(next);
    // Deleting frees a slot — clear the cap-reached banner if any.
    if (capError) setCapError(false);
  };

  const exportCurrent = () => {
    const payload = extractPrefs(viz);
    const blob = new Blob([JSON.stringify(payload, null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `operari-appearance-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const importFromFile = (file: File) => {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(String(reader.result));
        viz.applyPrefs(parsed);
      } catch {
        // Malformed JSON — surface an inline message rather than
        // crash so the user can retry with a fresh export.
        if (typeof window !== 'undefined') {
          window.alert(t.importFailed);
        }
      }
    };
    reader.readAsText(file);
  };

  const atCap = customPresets.length >= MAX_CUSTOM_PRESETS;

  return (
    <div className="space-y-4">
      <Section
        icon={<LayoutDashboard size={14} />}
        title={t.builtinPresetsLabel}
        hint={t.builtinPresetsHint}
      >
        <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
          {BUILTIN_PRESETS.map(preset => (
            <PresetCard
              key={preset.id}
              name={t[preset.labelKey]}
              description={t[preset.descriptionKey]}
              onApply={() => viz.applyPrefs(preset.patch)}
              applyLabel={t.applyLabel}
              accent={
                preset.patch.accentColor
                  ? ACCENT_HEX[preset.patch.accentColor]
                  : ACCENT_HEX[viz.accentColor]
              }
            />
          ))}
        </div>
      </Section>

      <Section icon={<Save size={14} />} title={t.customPresetsLabel} hint={t.customPresetsHint}>
        <div className="mb-3 flex gap-2">
          <input
            type="text"
            value={newName}
            onChange={e => setNewName(e.target.value)}
            placeholder={t.presetNamePlaceholder}
            disabled={atCap}
            className="flex-1 rounded-md border border-[var(--panel-border)] bg-[var(--app-bg)] px-3 py-1.5 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:border-[var(--accent-color)] focus:outline-none disabled:opacity-40"
          />
          <button
            onClick={saveCurrentAsPreset}
            disabled={!newName.trim() || atCap}
            className="bg-[var(--accent-color)]/10 hover:bg-[var(--accent-color)]/20 rounded-md border border-[var(--accent-color)] px-3 py-1.5 text-sm text-[var(--text-primary)] disabled:cursor-not-allowed disabled:opacity-40"
          >
            {t.saveCurrentLabel}
          </button>
        </div>
        {capError && (
          <div className="mb-3 rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs text-amber-400">
            {t.presetCapReached}
          </div>
        )}
        {customPresets.length === 0 ? (
          <div className="text-xs italic text-[var(--text-muted)]">{t.noCustomPresets}</div>
        ) : (
          <div className="space-y-2">
            {customPresets.map(preset => (
              <div
                key={preset.id}
                className="flex items-center justify-between rounded-md border border-[var(--panel-border)] bg-[var(--panel-bg)] px-3 py-2"
              >
                <div className="flex min-w-0 items-center gap-2">
                  <span
                    className="h-3 w-3 flex-shrink-0 rounded-full"
                    style={{
                      background: ACCENT_HEX[preset.patch.accentColor ?? viz.accentColor],
                    }}
                  />
                  <span className="truncate text-sm text-[var(--text-primary)]">{preset.name}</span>
                </div>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => viz.applyPrefs(preset.patch)}
                    className="hover:bg-[var(--accent-color)]/10 rounded-md px-2 py-1 text-xs text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                    title={t.applyLabel}
                  >
                    <Eye size={13} />
                  </button>
                  <button
                    onClick={() => deletePreset(preset.id)}
                    className="rounded-md px-2 py-1 text-xs text-[var(--text-muted)] hover:bg-red-500/10 hover:text-red-400"
                    title={t.deleteLabel}
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </Section>

      <Section title={t.importExportLabel} hint={t.importExportHint}>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={exportCurrent}
            className="hover:border-[var(--accent-color)]/50 inline-flex items-center gap-1.5 rounded-md border border-[var(--panel-border)] bg-[var(--panel-bg)] px-3 py-1.5 text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
          >
            <Download size={13} />
            {t.exportLabel}
          </button>
          <button
            onClick={() => fileInputRef.current?.click()}
            className="hover:border-[var(--accent-color)]/50 inline-flex items-center gap-1.5 rounded-md border border-[var(--panel-border)] bg-[var(--panel-bg)] px-3 py-1.5 text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
          >
            <Upload size={13} />
            {t.importLabel}
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="application/json"
            className="hidden"
            onChange={e => {
              const f = e.target.files?.[0];
              if (f) importFromFile(f);
              e.target.value = '';
            }}
          />
          <button
            onClick={() => {
              if (window.confirm(t.resetConfirm)) {
                viz.resetToDefaults();
              }
            }}
            className="inline-flex items-center gap-1.5 rounded-md border border-[var(--panel-border)] bg-[var(--panel-bg)] px-3 py-1.5 text-sm text-[var(--text-muted)] hover:border-red-500/40 hover:text-red-400"
          >
            <RotateCcw size={13} />
            {t.resetLabel}
          </button>
        </div>
      </Section>
    </div>
  );
}
