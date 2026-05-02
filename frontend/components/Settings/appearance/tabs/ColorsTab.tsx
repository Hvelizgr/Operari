'use client';

import { Check, Palette, Sparkles } from 'lucide-react';

import { ACCENT_HEX, type AccentColor, useVisualization } from '@/context/VisualizationContext';

import { Section, StatusColorRow } from '../primitives';
import type { Strings } from '../strings';

/**
 * V2 color personalization: accent + per-status overrides.
 *
 * Both bridge to V2 CSS vars in `applyToDocument`:
 *   - `accentColor` → `--rb-node-selected` (selected node ring + tinted accents)
 *   - `statusColors.running/success/failed/idle` → `--rb-edge-running/success/failed/skipped`
 *
 * Tints propagate to the React Flow editor without consuming the
 * VisualizationContext from inside every node — Tailwind's
 * `[color:var(--rb-edge-success)]` utilities pick up the override
 * automatically.
 */
export function ColorsTab({ t }: { t: Strings }) {
  const viz = useVisualization();
  return (
    <div className="space-y-4">
      <Section icon={<Palette size={14} />} title={t.accentLabel} hint={t.accentHint}>
        <div className="flex flex-wrap gap-2">
          {(
            [
              { id: 'emerald', label: t.accentEmerald },
              { id: 'sky', label: t.accentSky },
              { id: 'violet', label: t.accentViolet },
              { id: 'amber', label: t.accentAmber },
              { id: 'rose', label: t.accentRose },
              { id: 'slate', label: t.accentSlate },
            ] as { id: AccentColor; label: string }[]
          ).map(opt => {
            const active = viz.accentColor === opt.id;
            return (
              <button
                key={opt.id}
                onClick={() => viz.setAccentColor(opt.id)}
                className={`group flex items-center gap-2 rounded-md border px-2.5 py-1.5 text-xs transition-colors ${
                  active
                    ? 'bg-[var(--accent-color)]/10 border-[var(--accent-color)] text-[var(--text-primary)]'
                    : 'hover:border-[var(--accent-color)]/40 border-[var(--panel-border)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                }`}
              >
                <span
                  className="inline-block h-4 w-4 rounded-full ring-1 ring-black/20 dark:ring-white/10"
                  style={{ background: ACCENT_HEX[opt.id] }}
                />
                {opt.label}
                {active && <Check size={12} />}
              </button>
            );
          })}
        </div>
      </Section>

      <Section icon={<Sparkles size={14} />} title={t.statusColorsLabel} hint={t.statusColorsHint}>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <StatusColorRow
            label={t.statusRunning}
            statusKey="running"
            value={viz.statusColors.running}
            onChange={hex => viz.setStatusColor('running', hex)}
            resetLabel={t.resetLabel}
          />
          <StatusColorRow
            label={t.statusSuccess}
            statusKey="success"
            value={viz.statusColors.success}
            onChange={hex => viz.setStatusColor('success', hex)}
            resetLabel={t.resetLabel}
          />
          <StatusColorRow
            label={t.statusFailed}
            statusKey="failed"
            value={viz.statusColors.failed}
            onChange={hex => viz.setStatusColor('failed', hex)}
            resetLabel={t.resetLabel}
          />
          <StatusColorRow
            label={t.statusIdle}
            statusKey="idle"
            value={viz.statusColors.idle}
            onChange={hex => viz.setStatusColor('idle', hex)}
            resetLabel={t.resetLabel}
          />
        </div>
      </Section>
    </div>
  );
}
