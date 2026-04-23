'use client';

import { Sparkles, Zap as ZapIcon } from 'lucide-react';
import {
  useVisualization,
  ACCENT_HEX,
  type AnimationSpeed,
  type FlowStyle,
  type FlowSpeed,
  type RunningPulseVariant,
  type CompletionFlashVariant,
} from '@/context/VisualizationContext';
import { Section, PillGroup, PreviewCard, SliderRow, ToggleRow } from '../primitives';
import { FlowStylePreview } from '../previews';
import type { Strings } from '../strings';

export function FlowTab({ t }: { t: Strings }) {
  const viz = useVisualization();
  return (
    <div className="space-y-4">
      <Section icon={<Sparkles size={14} />} title={t.animSpeedLabel} hint={t.animSpeedHint}>
        <PillGroup
          value={viz.animationSpeed}
          onChange={viz.setAnimationSpeed}
          options={
            [
              { id: 'off', label: t.animSpeedOff },
              { id: 'calm', label: t.animSpeedCalm },
              { id: 'default', label: t.animSpeedDefault },
              { id: 'lively', label: t.animSpeedLively },
            ] as { id: AnimationSpeed; label: string }[]
          }
        />
      </Section>

      <Section icon={<ZapIcon size={14} />} title={t.flowLabel} hint={t.flowHint}>
        <ToggleRow
          label={t.flowEnabled}
          value={viz.flowAnimationsEnabled}
          onChange={viz.setFlowAnimationsEnabled}
          on={t.on}
          off={t.off}
        />
      </Section>

      <Section title={t.flowStyleLabel} hint={t.flowStyleHint}>
        <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
          {(
            [
              { id: 'orbs', label: t.flowOrbs },
              { id: 'dashes', label: t.flowDashes },
              { id: 'pulse', label: t.flowPulse },
              { id: 'comet', label: t.flowComet },
              { id: 'particles', label: t.flowParticles },
              { id: 'gradient', label: t.flowGradient },
              { id: 'off', label: t.flowOff },
            ] as { id: FlowStyle; label: string }[]
          ).map(opt => (
            <PreviewCard
              key={opt.id}
              active={viz.flowStyle === opt.id}
              label={opt.label}
              onClick={() => viz.setFlowStyle(opt.id)}
            >
              <FlowStylePreview style={opt.id} accent={ACCENT_HEX[viz.accentColor]} />
            </PreviewCard>
          ))}
        </div>
      </Section>

      <Section title={t.flowSpeedLabel} hint={t.flowSpeedHint}>
        <PillGroup
          value={viz.flowSpeed}
          onChange={viz.setFlowSpeed}
          options={
            [
              { id: 'slow', label: t.flowSpeedSlow },
              { id: 'normal', label: t.flowSpeedNormal },
              { id: 'fast', label: t.flowSpeedFast },
            ] as { id: FlowSpeed; label: string }[]
          }
        />
      </Section>

      {/* Particle size: meaningful whenever a particle-style flow is
                active. `dashes`, `pulse`, `gradient`, `off` ignore it. */}
      {(viz.flowStyle === 'particles' || viz.flowStyle === 'comet' || viz.flowStyle === 'orbs') && (
        <SliderRow
          title={t.particleSizeLabel}
          hint={t.particleSizeHint}
          value={viz.flowParticleSize}
          min={2}
          max={6}
          step={0.5}
          format={v => `${v.toFixed(1)}px`}
          onChange={viz.setFlowParticleSize}
        />
      )}

      {/* Particle count: only meaningful for `particles` — orbs is
                always 1, comet has a fixed 4-ghost trail. */}
      {viz.flowStyle === 'particles' && (
        <SliderRow
          title={t.particleCountLabel}
          hint={t.particleCountHint}
          value={viz.flowParticleCount}
          min={1}
          max={5}
          step={1}
          unit="×"
          onChange={viz.setFlowParticleCount}
        />
      )}

      <Section title={t.pulseVariantLabel} hint={t.pulseVariantHint}>
        <PillGroup
          value={viz.runningPulseVariant}
          onChange={viz.setRunningPulseVariant}
          options={
            [
              { id: 'breathe', label: t.pulseBreathe },
              { id: 'wave', label: t.pulseWave },
              { id: 'ripple', label: t.pulseRipple },
              { id: 'none', label: t.pulseNone },
            ] as { id: RunningPulseVariant; label: string }[]
          }
        />
      </Section>

      <Section title={t.flashVariantLabel} hint={t.flashVariantHint}>
        <PillGroup
          value={viz.completionFlashVariant}
          onChange={viz.setCompletionFlashVariant}
          options={
            [
              { id: 'flash', label: t.flashFlash },
              { id: 'bounce', label: t.flashBounce },
              { id: 'none', label: t.flashNone },
            ] as { id: CompletionFlashVariant; label: string }[]
          }
        />
      </Section>
    </div>
  );
}
