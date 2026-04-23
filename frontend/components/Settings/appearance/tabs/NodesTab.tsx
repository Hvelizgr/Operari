'use client';

import { Palette, Sparkles, Box as BoxIcon, Check } from 'lucide-react';
import {
  useVisualization,
  ACCENT_HEX,
  type NodeDensity,
  type NodeStyle,
  type NodeShadowPreset,
  type NodeIconSize,
  type AccentColor,
} from '@/context/VisualizationContext';
import { Section, PillGroup, PreviewCard, SliderRow, StatusColorRow } from '../primitives';
import { NodeStylePreview } from '../previews';
import type { Strings } from '../strings';

export function NodesTab({ t }: { t: Strings }) {
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

      <Section icon={<BoxIcon size={14} />} title={t.densityLabel} hint={t.densityHint}>
        <PillGroup
          value={viz.nodeDensity}
          onChange={viz.setNodeDensity}
          options={
            [
              { id: 'compact', label: t.densityCompact },
              { id: 'comfortable', label: t.densityComfortable },
              { id: 'spacious', label: t.densitySpacious },
            ] as { id: NodeDensity; label: string }[]
          }
        />
      </Section>

      <Section icon={<BoxIcon size={14} />} title={t.nodeStyleLabel} hint={t.nodeStyleHint}>
        <div className="grid grid-cols-2 gap-2 md:grid-cols-5">
          {(
            [
              { id: 'modern', label: t.nodeStyleModern },
              { id: 'minimal', label: t.nodeStyleMinimal },
              { id: 'bold', label: t.nodeStyleBold },
              { id: 'neon', label: t.nodeStyleNeon },
              { id: 'glass', label: t.nodeStyleGlass },
            ] as { id: NodeStyle; label: string }[]
          ).map(opt => (
            <PreviewCard
              key={opt.id}
              active={viz.nodeStyle === opt.id}
              label={opt.label}
              onClick={() => viz.setNodeStyle(opt.id)}
            >
              <NodeStylePreview style={opt.id} accent={ACCENT_HEX[viz.accentColor]} />
            </PreviewCard>
          ))}
        </div>
      </Section>

      <Section title={t.shadowLabel} hint={t.shadowHint}>
        <PillGroup
          value={viz.nodeShadowPreset}
          onChange={viz.setNodeShadowPreset}
          options={
            [
              { id: 'none', label: t.shadowNone },
              { id: 'sm', label: t.shadowSm },
              { id: 'md', label: t.shadowMd },
              { id: 'lg', label: t.shadowLg },
              { id: 'xl', label: t.shadowXl },
            ] as { id: NodeShadowPreset; label: string }[]
          }
        />
      </Section>

      <Section title={t.iconSizeLabel} hint={t.iconSizeHint}>
        <PillGroup
          value={viz.nodeIconSize}
          onChange={viz.setNodeIconSize}
          options={
            [
              { id: 'sm', label: t.iconSm },
              { id: 'md', label: t.iconMd },
              { id: 'lg', label: t.iconLg },
            ] as { id: NodeIconSize; label: string }[]
          }
        />
      </Section>

      <SliderRow
        title={t.radiusLabel}
        hint={t.radiusHint}
        value={viz.nodeRadiusBoost}
        min={0}
        max={20}
        step={1}
        unit="px"
        onChange={viz.setNodeRadiusBoost}
      />

      <SliderRow
        title={t.scaleLabel}
        hint={t.scaleHint}
        value={viz.nodeScale}
        min={0.85}
        max={1.2}
        step={0.05}
        format={v => `${Math.round(v * 100)}%`}
        onChange={viz.setNodeScale}
      />

      <SliderRow
        title={t.glowLabel}
        hint={t.glowHint}
        value={viz.glowIntensity}
        min={0}
        max={2}
        step={0.1}
        format={v => `${v.toFixed(1)}x`}
        onChange={viz.setGlowIntensity}
      />

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
