'use client';

import { Grid3x3, LayoutDashboard } from 'lucide-react';

import {
  type BgPattern,
  type MinimapPosition,
  useVisualization,
} from '@/context/VisualizationContext';

import { BgPatternPreview } from '../previews';
import { PillGroup, PreviewCard, Section, SliderRow } from '../primitives';
import type { Strings } from '../strings';

export function CanvasTab({ t }: { t: Strings }) {
  const viz = useVisualization();
  return (
    <div className="space-y-4">
      <Section icon={<Grid3x3 size={14} />} title={t.bgPatternLabel} hint={t.bgPatternHint}>
        <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
          {(
            [
              { id: 'dots', label: t.bgDots },
              { id: 'grid', label: t.bgGrid },
              { id: 'lines', label: t.bgLines },
              { id: 'none', label: t.bgNone },
            ] as { id: BgPattern; label: string }[]
          ).map(opt => (
            <PreviewCard
              key={opt.id}
              active={viz.bgPattern === opt.id}
              label={opt.label}
              onClick={() => viz.setBgPattern(opt.id)}
            >
              <BgPatternPreview pattern={opt.id} />
            </PreviewCard>
          ))}
        </div>
      </Section>

      <Section title={t.gridSizeLabel} hint={t.gridSizeHint}>
        <PillGroup
          value={viz.bgGridSize}
          onChange={viz.setBgGridSize}
          options={
            [
              { id: 10, label: '10px' },
              { id: 20, label: '20px' },
              { id: 40, label: '40px' },
              { id: 80, label: '80px' },
            ] as { id: number; label: string }[]
          }
        />
      </Section>

      <SliderRow
        title={t.gridOpacityLabel}
        hint={t.gridOpacityHint}
        value={viz.bgGridOpacity}
        min={0}
        max={1}
        step={0.05}
        format={v => `${Math.round(v * 100)}%`}
        onChange={viz.setBgGridOpacity}
      />

      <Section icon={<LayoutDashboard size={14} />} title={t.minimapLabel} hint={t.minimapHint}>
        <PillGroup
          value={viz.minimapPosition}
          onChange={viz.setMinimapPosition}
          options={
            [
              { id: 'top-left', label: t.minimapTopLeft },
              { id: 'top-right', label: t.minimapTopRight },
              { id: 'bottom-left', label: t.minimapBottomLeft },
              { id: 'bottom-right', label: t.minimapBottomRight },
              { id: 'hidden', label: t.minimapHidden },
            ] as { id: MinimapPosition; label: string }[]
          }
        />
      </Section>
    </div>
  );
}
