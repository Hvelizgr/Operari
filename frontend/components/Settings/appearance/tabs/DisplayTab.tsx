'use client';

import { Info, Monitor, Moon, Sparkles, Type } from 'lucide-react';

import { type FontScale, type ThemeMode, useVisualization } from '@/context/VisualizationContext';

import { PillGroup, Section } from '../primitives';
import type { Strings } from '../strings';

/**
 * V2 personalization controls — the only tab whose options actually
 * apply to the React Flow editor today. Theme, font scale and
 * reduced-motion are wired through `applyToDocument` to root data-*
 * attributes that V2 chrome reads via Tailwind's `data-[theme=...]`
 * variants and the `--font-scale` / `data-anim` CSS gates.
 *
 * The other tabs in this page (Nodes, Connections, Flow, Canvas)
 * target the legacy editor and a chunk of their controls don't
 * propagate to the React Flow canvas. The V2 banner here makes that
 * explicit so the operator doesn't change a knob and wonder why
 * nothing happens.
 */
export function DisplayTab({ t }: { t: Strings }) {
  const viz = useVisualization();

  return (
    <div className="space-y-4">
      <div className="flex items-start gap-2 rounded-lg border border-amber-500/20 bg-amber-500/5 p-3 text-xs text-amber-200">
        <Info size={14} className="mt-0.5 shrink-0" />
        <div>
          <div className="font-semibold">{t.v2NoteTitle}</div>
          <div className="mt-0.5 text-amber-200/80">{t.v2Note}</div>
        </div>
      </div>

      <Section icon={<Moon size={14} />} title={t.themeLabel} hint={t.themeHint}>
        <PillGroup
          value={viz.theme}
          onChange={viz.setTheme}
          options={
            [
              { id: 'dark', label: t.themeDark },
              { id: 'light', label: t.themeLight },
              { id: 'midnight', label: t.themeMidnight },
            ] as { id: ThemeMode; label: string }[]
          }
        />
      </Section>

      <Section icon={<Type size={14} />} title={t.fontScaleLabel} hint={t.fontScaleHint}>
        <PillGroup
          value={viz.fontScale}
          onChange={viz.setFontScale}
          options={
            [
              { id: 'sm', label: t.fontSm },
              { id: 'md', label: t.fontMd },
              { id: 'lg', label: t.fontLg },
              { id: 'xl', label: t.fontXl },
            ] as { id: FontScale; label: string }[]
          }
        />
      </Section>

      <Section
        icon={<Sparkles size={14} />}
        title={t.reducedMotionLabel}
        hint={t.reducedMotionHint}
      >
        <PillGroup
          value={viz.reducedMotion ? 'on' : 'off'}
          onChange={v => viz.setReducedMotion(v === 'on')}
          options={[
            { id: 'off', label: t.off },
            { id: 'on', label: t.on },
          ]}
        />
      </Section>

      <Section icon={<Monitor size={14} />} title={t.fontScaleLabel}>
        <div
          className="rounded-md border border-[var(--panel-border)] bg-[var(--panel-bg)] p-4 text-[color:var(--rb-node-text)]"
          style={{ fontSize: 'calc(var(--font-scale, 1) * 0.875rem)' }}
        >
          <div className="font-semibold">Lorem ipsum dolor sit amet</div>
          <div className="mt-1 text-xs text-[color:var(--rb-node-muted)]">
            Consectetur adipiscing elit. The quick brown fox jumps over the lazy dog 0123456789.
          </div>
        </div>
      </Section>
    </div>
  );
}
