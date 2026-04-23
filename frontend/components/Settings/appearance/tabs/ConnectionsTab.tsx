'use client';

import { Spline } from 'lucide-react';
import {
  useVisualization,
  ACCENT_HEX,
  type LineStyle,
  type EdgeDashPattern,
} from '@/context/VisualizationContext';
import { Section, PreviewCard, SliderRow, ToggleRow } from '../primitives';
import { LineStylePreview, DashPreview } from '../previews';
import type { Strings } from '../strings';

export function ConnectionsTab({ t }: { t: Strings }) {
  const viz = useVisualization();
  return (
    <div className="space-y-4">
      <Section icon={<Spline size={14} />} title={t.lineStyleLabel} hint={t.lineStyleHint}>
        <div className="grid grid-cols-3 gap-2">
          {(
            [
              { id: 'bezier', label: t.lineBezier },
              { id: 'straight', label: t.lineStraight },
              { id: 'step', label: t.lineStep },
            ] as { id: LineStyle; label: string }[]
          ).map(opt => (
            <PreviewCard
              key={opt.id}
              active={viz.lineStyle === opt.id}
              label={opt.label}
              onClick={() => viz.setLineStyle(opt.id)}
            >
              <LineStylePreview style={opt.id} accent={ACCENT_HEX[viz.accentColor]} />
            </PreviewCard>
          ))}
        </div>
      </Section>

      <SliderRow
        title={t.thicknessLabel}
        hint={t.thicknessHint}
        value={viz.edgeThickness}
        min={1}
        max={4}
        step={0.2}
        format={v => `${v.toFixed(1)}px`}
        onChange={viz.setEdgeThickness}
      />

      <Section title={t.dashLabel} hint={t.dashHint}>
        <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
          {(
            [
              { id: 'solid', label: t.dashSolid },
              { id: 'dotted', label: t.dashDotted },
              { id: 'short-dash', label: t.dashShort },
              { id: 'long-dash', label: t.dashLong },
            ] as { id: EdgeDashPattern; label: string }[]
          ).map(opt => (
            <PreviewCard
              key={opt.id}
              active={viz.edgeDashPattern === opt.id}
              label={opt.label}
              onClick={() => viz.setEdgeDashPattern(opt.id)}
            >
              <DashPreview pattern={opt.id} accent={ACCENT_HEX[viz.accentColor]} />
            </PreviewCard>
          ))}
        </div>
      </Section>

      <Section title={t.arrowLabel} hint={t.arrowHint}>
        <ToggleRow
          label={t.arrowEnabled}
          value={viz.edgeArrowEnabled}
          onChange={viz.setEdgeArrowEnabled}
          on={t.on}
          off={t.off}
        />
        {viz.edgeArrowEnabled && (
          <SliderRow
            title={t.arrowSizeLabel}
            hint={t.arrowSizeHint}
            value={viz.edgeArrowSize}
            min={4}
            max={14}
            step={1}
            unit="px"
            onChange={viz.setEdgeArrowSize}
            bare
          />
        )}
      </Section>

      <SliderRow
        title={t.idleOpacityLabel}
        hint={t.idleOpacityHint}
        value={viz.edgeIdleOpacity}
        min={0.3}
        max={1}
        step={0.05}
        format={v => `${Math.round(v * 100)}%`}
        onChange={viz.setEdgeIdleOpacity}
      />
    </div>
  );
}
