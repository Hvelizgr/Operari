'use client';

import { Gauge, Sparkles, Wand2, Zap } from 'lucide-react';

import {
  ACCENT_HEX,
  FLOW_SPEED_MULT,
  type FlowFlavor,
  type FlowSpeed,
  useVisualization,
} from '@/context/VisualizationContext';

import { PillGroup, Section } from '../primitives';
import type { Strings } from '../strings';

/**
 * V2 connection-animation controls + a live SVG preview of every
 * effect the running edge plays in the editor. The preview mirrors
 * `SmartBezierEdge`'s render pipeline:
 *   1. Sliding gradient stroke (gradient `<animate>`).
 *   2. Marching dashes (`stroke-dasharray` + dashoffset animation).
 *   3. Comet trail — two staggered orbs riding the path.
 *
 * All three play together — V2 doesn't expose a "pick a flavor"
 * toggle (that was V1's `flowStyle`), so the preview shows the
 * combined effect. Speed picks scale every `dur` proportionally.
 */
export function FlowTab({ t }: { t: Strings }) {
  const viz = useVisualization();
  return (
    <div className="space-y-4">
      <Section icon={<Sparkles size={14} />} title={t.flowPreviewLabel} hint={t.flowPreviewHint}>
        <FlowPreview
          enabled={viz.flowAnimationsEnabled}
          speed={viz.flowSpeed}
          flavor={viz.flowFlavor}
          accent={ACCENT_HEX[viz.accentColor]}
        />
      </Section>

      <Section icon={<Wand2 size={14} />} title={t.flowFlavorLabel} hint={t.flowFlavorHint}>
        <PillGroup
          value={viz.flowFlavor}
          onChange={viz.setFlowFlavor}
          options={
            [
              { id: 'all', label: t.flavorAll },
              { id: 'gradient', label: t.flavorGradient },
              { id: 'dashes', label: t.flavorDashes },
              { id: 'comet', label: t.flavorComet },
              { id: 'off', label: t.flavorOff },
            ] as { id: FlowFlavor; label: string }[]
          }
        />
      </Section>

      <Section icon={<Zap size={14} />} title={t.flowAnimationsLabel} hint={t.flowAnimationsHint}>
        <PillGroup
          value={viz.flowAnimationsEnabled ? 'on' : 'off'}
          onChange={v => viz.setFlowAnimationsEnabled(v === 'on')}
          options={[
            { id: 'on', label: t.on },
            { id: 'off', label: t.off },
          ]}
        />
      </Section>

      <Section icon={<Gauge size={14} />} title={t.flowSpeedLabel} hint={t.flowSpeedHint}>
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
    </div>
  );
}

/**
 * Mini SVG preview of the V2 running edge. Reuses the same animation
 * primitives `SmartBezierEdge` does (linearGradient with `<animate>`,
 * a path with marching `stroke-dasharray`, and `<animateMotion>`
 * orbs) so what the user sees here is exactly what they'll see in
 * the editor at runtime.
 */
function FlowPreview({
  enabled,
  speed,
  flavor,
  accent,
}: {
  enabled: boolean;
  speed: FlowSpeed;
  flavor: FlowFlavor;
  accent: string;
}) {
  const mult = FLOW_SPEED_MULT[speed] ?? 1;
  const gradientDur = (1.6 / mult).toFixed(2);
  const dashDur = (0.8 / mult).toFixed(2);
  const orbDur = (1.6 / mult).toFixed(2);
  const path = 'M20 60 C 100 20, 240 100, 320 60';
  const pathId = 'flow-preview-path';
  const gradId = 'flow-preview-grad';
  const live = enabled && flavor !== 'off';
  const showGradient = live && (flavor === 'all' || flavor === 'gradient');
  const showDashes = live && (flavor === 'all' || flavor === 'dashes');
  const showComet = live && (flavor === 'all' || flavor === 'comet');

  return (
    <div className="relative overflow-hidden rounded-md border border-[var(--panel-border)] bg-zinc-950 p-3">
      <svg viewBox="0 0 340 120" className="h-32 w-full">
        <defs>
          <linearGradient id={gradId} x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor={accent} stopOpacity="0.2" />
            <stop offset="50%" stopColor={accent} stopOpacity="1" />
            <stop offset="100%" stopColor={accent} stopOpacity="0.2" />
            {showGradient ? (
              <animate
                attributeName="x1"
                values="-100%;100%"
                dur={`${gradientDur}s`}
                repeatCount="indefinite"
              />
            ) : null}
          </linearGradient>
        </defs>

        {/* Source + target node placeholders so the line has anchors. */}
        <rect
          x="4"
          y="48"
          width="32"
          height="24"
          rx="4"
          fill="#18181b"
          stroke="#3f3f46"
          strokeWidth="1"
        />
        <rect
          x="304"
          y="48"
          width="32"
          height="24"
          rx="4"
          fill="#18181b"
          stroke="#3f3f46"
          strokeWidth="1"
        />

        {/* The connection. The 3 effects render or not based on
            `flavor`: gradient (sliding stroke), dashes (marching
            offset), comet (orbs riding the path). With `all` they
            stack the way SmartBezierEdge does in the real editor. */}
        <path
          id={pathId}
          d={path}
          stroke={showGradient ? `url(#${gradId})` : accent}
          strokeWidth={2}
          strokeDasharray={showDashes ? '8 6' : undefined}
          fill="none"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          {showDashes ? (
            <animate
              attributeName="stroke-dashoffset"
              from="0"
              to="-28"
              dur={`${dashDur}s`}
              repeatCount="indefinite"
            />
          ) : null}
        </path>

        {showComet
          ? [0, -Number(orbDur) / 2].map((delay, idx) => (
              <circle key={idx} r={4} fill={accent}>
                <animateMotion dur={`${orbDur}s`} repeatCount="indefinite" begin={`${delay}s`}>
                  <mpath href={`#${pathId}`} />
                </animateMotion>
              </circle>
            ))
          : null}
      </svg>
      <div className="mt-1 flex items-center justify-between text-[10px] text-zinc-500">
        <span className="font-mono uppercase tracking-wider">
          {live ? `${flavor} × ${speed}` : enabled ? 'flavor: off' : 'animations off'}
        </span>
        <span className="font-mono">{live ? `${gradientDur}s / cycle` : 'static'}</span>
      </div>
    </div>
  );
}
