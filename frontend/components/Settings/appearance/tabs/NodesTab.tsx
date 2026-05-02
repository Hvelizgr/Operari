'use client';

import { Box, Hexagon, Layers, Maximize2, Tag } from 'lucide-react';

import {
  type NodeCorners,
  type NodeDensityV2,
  type NodeShape,
  type NodeVariant,
  useVisualization,
} from '@/context/VisualizationContext';

import { PillGroup, Section } from '../primitives';
import type { Strings } from '../strings';

/**
 * V2 node shape personalization. Replaces the V1-only NodesTab that
 * targeted `.wf_node` (the pre-React-Flow chrome). Every control here
 * applies to `.rb-node` via data-attributes set in `applyToDocument`
 * and CSS overrides in `app/globals.css`. No prop drilling.
 *
 * The variant + corners + header-band controls are orthogonal so
 * users can mix `outlined` with `extra-rounded` and `header-band off`
 * to get a pill-style flat node, or `card` with `header-band on` for
 * a heavy elevated step. Live preview happens in the editor itself —
 * the operator sees the change the moment they pick a value.
 */
export function NodesTab({ t }: { t: Strings }) {
  const viz = useVisualization();

  return (
    <div className="space-y-4">
      <Section icon={<Box size={14} />} title={t.nodeVariantLabel} hint={t.nodeVariantHint}>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          {(
            [
              { id: 'default', label: t.nodeVariantDefault },
              { id: 'minimal', label: t.nodeVariantMinimal },
              { id: 'card', label: t.nodeVariantCard },
              { id: 'outlined', label: t.nodeVariantOutlined },
            ] as { id: NodeVariant; label: string }[]
          ).map(opt => {
            const active = viz.nodeVariant === opt.id;
            return (
              <button
                key={opt.id}
                type="button"
                onClick={() => viz.setNodeVariant(opt.id)}
                className={`flex flex-col items-center gap-2 rounded-md border p-3 transition-colors ${
                  active
                    ? 'border-emerald-500 bg-emerald-500/10'
                    : 'border-[var(--panel-border)] hover:border-emerald-500/40'
                }`}
              >
                <NodeVariantPreview variant={opt.id} />
                <span className="text-xs text-[var(--text-primary)]">{opt.label}</span>
              </button>
            );
          })}
        </div>
      </Section>

      <Section icon={<Layers size={14} />} title={t.nodeCornersLabel} hint={t.nodeCornersHint}>
        <PillGroup
          value={viz.nodeCorners}
          onChange={viz.setNodeCorners}
          options={
            [
              { id: 'sharp', label: t.nodeCornersSharp },
              { id: 'rounded', label: t.nodeCornersRounded },
              { id: 'extra-rounded', label: t.nodeCornersExtra },
            ] as { id: NodeCorners; label: string }[]
          }
        />
      </Section>

      <Section icon={<Tag size={14} />} title={t.nodeHeaderBandLabel} hint={t.nodeHeaderBandHint}>
        <PillGroup
          value={viz.nodeHeaderBand ? 'on' : 'off'}
          onChange={v => viz.setNodeHeaderBand(v === 'on')}
          options={[
            { id: 'on', label: t.on },
            { id: 'off', label: t.off },
          ]}
        />
      </Section>

      <Section icon={<Hexagon size={14} />} title={t.nodeShapeLabel} hint={t.nodeShapeHint}>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
          {(
            [
              { id: 'rounded-rect', label: t.nodeShapeRoundedRect },
              { id: 'pill', label: t.nodeShapePill },
              { id: 'hex', label: t.nodeShapeHex },
              { id: 'circle', label: t.nodeShapeCircle },
              { id: 'rectangle', label: t.nodeShapeRectangle },
            ] as { id: NodeShape; label: string }[]
          ).map(opt => {
            const active = viz.nodeShape === opt.id;
            return (
              <button
                key={opt.id}
                type="button"
                onClick={() => viz.setNodeShape(opt.id)}
                className={`flex flex-col items-center gap-2 rounded-md border p-3 transition-colors ${
                  active
                    ? 'border-emerald-500 bg-emerald-500/10'
                    : 'border-[var(--panel-border)] hover:border-emerald-500/40'
                }`}
              >
                <NodeShapePreview shape={opt.id} />
                <span className="text-xs text-[var(--text-primary)]">{opt.label}</span>
              </button>
            );
          })}
        </div>
      </Section>

      <Section
        icon={<Maximize2 size={14} />}
        title={t.nodeDensityV2Label}
        hint={t.nodeDensityV2Hint}
      >
        <PillGroup
          value={viz.nodeDensityV2}
          onChange={viz.setNodeDensityV2}
          options={
            [
              { id: 'comfortable', label: t.nodeDensityV2Comfortable },
              { id: 'compact', label: t.nodeDensityV2Compact },
              { id: 'dense', label: t.nodeDensityV2Dense },
            ] as { id: NodeDensityV2; label: string }[]
          }
        />
      </Section>
    </div>
  );
}

/**
 * Preview tile for each node shape. Hex / circle use clip-path the
 * same way globals.css does so the user sees the actual silhouette
 * before applying.
 */
function NodeShapePreview({ shape }: { shape: NodeShape }) {
  const base = 'flex h-12 w-full items-center justify-center bg-emerald-600/80 text-white';
  const variants: Record<NodeShape, string> = {
    'rounded-rect': `${base} rounded-md`,
    pill: `${base} rounded-full`,
    rectangle: base,
    hex: base,
    circle: `${base} aspect-square w-12 self-center rounded-full`,
  };
  const style: Record<NodeShape, React.CSSProperties | undefined> = {
    'rounded-rect': undefined,
    pill: undefined,
    rectangle: undefined,
    hex: { clipPath: 'polygon(8% 0, 92% 0, 100% 50%, 92% 100%, 8% 100%, 0 50%)' },
    circle: undefined,
  };
  return (
    <div className={variants[shape]} style={style[shape]}>
      <span className="font-mono text-[10px]">step</span>
    </div>
  );
}

/**
 * Tiny visual preview of each node variant. Mirrors what `.rb-node`
 * looks like under each variant so the user can compare without
 * actually opening the editor.
 */
function NodeVariantPreview({ variant }: { variant: NodeVariant }) {
  const baseClass = 'flex h-14 w-full flex-col overflow-hidden rounded-md text-[10px]';
  const styles: Record<NodeVariant, { wrapper: string; header?: string; body: string }> = {
    default: {
      wrapper: 'border border-zinc-700 bg-zinc-900 shadow-md',
      header: 'h-1/3 bg-emerald-600 px-1.5 text-white',
      body: 'flex-1 p-1.5 text-zinc-200',
    },
    minimal: {
      wrapper: 'border border-zinc-700/50 bg-zinc-900',
      header: 'h-1/3 bg-emerald-600 px-1.5 text-white',
      body: 'flex-1 p-1.5 text-zinc-200',
    },
    card: {
      wrapper: 'bg-zinc-900 shadow-xl',
      body: 'flex-1 p-1.5 text-zinc-200',
    },
    outlined: {
      wrapper: 'border-2 border-emerald-500',
      body: 'flex-1 p-1.5 text-zinc-200',
    },
  };
  const s = styles[variant];
  return (
    <div className={`${baseClass} ${s.wrapper}`}>
      {s.header ? <div className={`flex items-center ${s.header}`}>HTTP</div> : null}
      <div className={s.body}>my step</div>
    </div>
  );
}
