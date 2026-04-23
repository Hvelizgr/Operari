'use client';

import type {
  NodeStyle,
  LineStyle,
  FlowStyle,
  EdgeDashPattern,
  BgPattern,
  VisualizationPrefs,
} from '@/context/VisualizationContext';
import { ACCENT_HEX } from '@/context/VisualizationContext';

/* ─────────────────────────────────────────────────────────────
   Preview SVGs.

   These intentionally duplicate a slimmer version of the canvas
   renderer logic — the canvas is Canvas2D (no DOM) and these are SVG
   with SMIL so they can animate inside the settings panel without
   spinning up the real editor. Keep the flow-style preview list in
   sync with `FlowStyle` unions in VisualizationContext.
   ───────────────────────────────────────────────────────────── */

export function NodeStylePreview({ style, accent }: { style: NodeStyle; accent: string }) {
  const presets: Record<
    NodeStyle,
    {
      shadow: string;
      radius: number;
      borderWidth: number;
      borderColor: string;
      bg: string;
      blur?: string;
    }
  > = {
    modern: {
      shadow: '0 4px 10px rgba(0,0,0,0.25)',
      radius: 8,
      borderWidth: 1.5,
      borderColor: 'var(--panel-border)',
      bg: 'var(--panel-bg)',
    },
    minimal: {
      shadow: '0 1px 2px rgba(0,0,0,0.12)',
      radius: 2,
      borderWidth: 1,
      borderColor: 'var(--panel-border)',
      bg: 'var(--panel-bg)',
    },
    bold: {
      shadow: '0 6px 14px rgba(0,0,0,0.4)',
      radius: 12,
      borderWidth: 2.5,
      borderColor: 'var(--panel-border)',
      bg: 'var(--panel-bg)',
    },
    neon: {
      shadow: `0 0 0 1px ${hexAlpha(accent, 0.55)}, 0 0 12px ${hexAlpha(accent, 0.55)}`,
      radius: 8,
      borderWidth: 1,
      borderColor: hexAlpha(accent, 0.7),
      bg: 'var(--panel-bg)',
    },
    glass: {
      shadow: '0 4px 14px rgba(0,0,0,0.3)',
      radius: 10,
      borderWidth: 1,
      borderColor: 'rgba(255,255,255,0.14)',
      bg: 'rgba(255,255,255,0.06)',
      blur: 'saturate(140%) blur(6px)',
    },
  };
  const p = presets[style];
  return (
    <div
      className="flex h-11 w-[88%] items-center gap-1.5 px-2"
      style={{
        background: p.bg,
        borderRadius: p.radius,
        border: `${p.borderWidth}px solid ${p.borderColor}`,
        boxShadow: p.shadow,
        backdropFilter: p.blur,
        WebkitBackdropFilter: p.blur,
        borderLeft: `3px solid ${accent}`,
      }}
    >
      <span className="inline-block h-3 w-3 rounded-sm" style={{ background: accent }} />
      <span className="flex-1 space-y-1">
        <span className="bg-[var(--text-muted)]/50 block h-1.5 rounded" style={{ width: '70%' }} />
        <span className="bg-[var(--text-muted)]/30 block h-1 rounded" style={{ width: '50%' }} />
      </span>
    </div>
  );
}

export function LineStylePreview({ style, accent }: { style: LineStyle; accent: string }) {
  const d =
    style === 'straight'
      ? 'M8 32 L80 16'
      : style === 'step'
        ? 'M8 32 L44 32 L44 16 L80 16'
        : 'M8 32 C 32 32, 56 16, 80 16';
  return (
    <svg viewBox="0 0 88 48" className="h-full w-full">
      <circle cx="8" cy="32" r="3.5" fill={accent} />
      <circle cx="80" cy="16" r="3.5" fill={accent} />
      <path
        d={d}
        stroke={accent}
        strokeWidth="2"
        fill="none"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function DashPreview({ pattern, accent }: { pattern: EdgeDashPattern; accent: string }) {
  const dashArray =
    pattern === 'dotted'
      ? '1 4'
      : pattern === 'short-dash'
        ? '4 4'
        : pattern === 'long-dash'
          ? '10 6'
          : undefined;
  return (
    <svg viewBox="0 0 88 32" className="h-full w-full">
      <path
        d="M4 16 L84 16"
        stroke={accent}
        strokeWidth="2"
        fill="none"
        strokeLinecap="round"
        strokeDasharray={dashArray}
      />
    </svg>
  );
}

export function FlowStylePreview({ style, accent }: { style: FlowStyle; accent: string }) {
  const pathD = 'M8 24 C 32 24, 56 24, 80 24';
  if (style === 'off') {
    return (
      <svg viewBox="0 0 88 48" className="h-full w-full">
        <path d={pathD} stroke={accent} strokeWidth="2" fill="none" />
      </svg>
    );
  }
  if (style === 'orbs') {
    return (
      <svg viewBox="0 0 88 48" className="h-full w-full">
        <path id="fp-orbs" d={pathD} stroke={accent} strokeWidth="2" fill="none" />
        <circle r="3" fill={accent}>
          <animateMotion dur="1.6s" repeatCount="indefinite">
            <mpath href="#fp-orbs" />
          </animateMotion>
        </circle>
      </svg>
    );
  }
  if (style === 'dashes') {
    return (
      <svg viewBox="0 0 88 48" className="h-full w-full">
        <path d={pathD} stroke={accent} strokeWidth="2" strokeDasharray="5 6" fill="none">
          <animate
            attributeName="stroke-dashoffset"
            from="0"
            to="-22"
            dur="0.8s"
            repeatCount="indefinite"
          />
        </path>
      </svg>
    );
  }
  if (style === 'pulse') {
    return (
      <svg viewBox="0 0 88 48" className="h-full w-full">
        <path d={pathD} stroke={accent} strokeWidth="2" fill="none">
          <animate
            attributeName="opacity"
            values="0.35;1;0.35"
            dur="1.8s"
            repeatCount="indefinite"
          />
          <animate
            attributeName="stroke-width"
            values="1.5;3;1.5"
            dur="1.8s"
            repeatCount="indefinite"
          />
        </path>
      </svg>
    );
  }
  if (style === 'comet') {
    return (
      <svg viewBox="0 0 88 48" className="h-full w-full">
        <path id="fp-comet" d={pathD} stroke={accent} strokeWidth="2" fill="none" opacity="0.45" />
        <circle r="3" fill={accent} opacity="0.4">
          <animateMotion dur="1.6s" repeatCount="indefinite" begin="-0.25s">
            <mpath href="#fp-comet" />
          </animateMotion>
        </circle>
        <circle r="3.5" fill={accent} opacity="0.7">
          <animateMotion dur="1.6s" repeatCount="indefinite" begin="-0.12s">
            <mpath href="#fp-comet" />
          </animateMotion>
        </circle>
        <circle r="4" fill={accent}>
          <animateMotion dur="1.6s" repeatCount="indefinite">
            <mpath href="#fp-comet" />
          </animateMotion>
        </circle>
      </svg>
    );
  }
  if (style === 'particles') {
    return (
      <svg viewBox="0 0 88 48" className="h-full w-full">
        <path id="fp-parts" d={pathD} stroke={accent} strokeWidth="2" fill="none" />
        {[0, 0.33, 0.66].map(offset => (
          <circle key={offset} r="2.5" fill={accent}>
            <animateMotion dur="1.8s" repeatCount="indefinite" begin={`-${offset * 1.8}s`}>
              <mpath href="#fp-parts" />
            </animateMotion>
          </circle>
        ))}
      </svg>
    );
  }
  // gradient
  return (
    <svg viewBox="0 0 88 48" className="h-full w-full">
      <defs>
        <linearGradient id="fp-grad" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor={accent} stopOpacity="0.2" />
          <stop offset="50%" stopColor={accent} stopOpacity="1" />
          <stop offset="100%" stopColor={accent} stopOpacity="0.2" />
          <animate attributeName="x1" values="-100%;0%;100%" dur="1.6s" repeatCount="indefinite" />
          <animate attributeName="x2" values="0%;100%;200%" dur="1.6s" repeatCount="indefinite" />
        </linearGradient>
      </defs>
      <path d={pathD} stroke="url(#fp-grad)" strokeWidth="3" fill="none" />
    </svg>
  );
}

export function BgPatternPreview({ pattern }: { pattern: BgPattern }) {
  if (pattern === 'none') {
    return <div className="bg-[var(--app-bg)]/40 h-full w-full rounded" />;
  }
  const bg =
    pattern === 'dots'
      ? 'radial-gradient(circle, var(--text-muted) 1px, transparent 1.5px) 0 0 / 10px 10px'
      : pattern === 'grid'
        ? 'linear-gradient(var(--panel-border) 1px, transparent 1px) 0 0 / 10px 10px, linear-gradient(90deg, var(--panel-border) 1px, transparent 1px) 0 0 / 10px 10px'
        : 'repeating-linear-gradient(0deg, transparent, transparent 8px, var(--panel-border) 8px, var(--panel-border) 9px)';
  return <div className="h-full w-full rounded" style={{ background: bg, opacity: 0.8 }} />;
}

/**
 * Big "what will my canvas look like" panel rendered at the top of the
 * Appearance page. Composes nodes + line + flow + background so every
 * tab's change shows combined effect. Uses SVG + SMIL so it stays
 * self-contained and doesn't depend on the real editor being mounted.
 */
export function LivePreview({ prefs, animsOn }: { prefs: VisualizationPrefs; animsOn: boolean }) {
  const accent = ACCENT_HEX[prefs.accentColor];
  const path =
    prefs.lineStyle === 'straight'
      ? 'M60 60 L220 60'
      : prefs.lineStyle === 'step'
        ? 'M60 60 L140 60 L140 60 L220 60'
        : 'M60 60 C 110 60, 170 60, 220 60';
  const strokeWidth = prefs.edgeThickness;
  const dashArray =
    prefs.edgeDashPattern === 'dotted'
      ? '1 4'
      : prefs.edgeDashPattern === 'short-dash'
        ? '4 4'
        : prefs.edgeDashPattern === 'long-dash'
          ? '10 6'
          : undefined;
  return (
    <div
      className="relative overflow-hidden rounded-md border border-[var(--panel-border)]"
      style={{
        height: 128,
        background: bgLayer(prefs.bgPattern, prefs.bgGridSize, prefs.bgGridOpacity),
      }}
    >
      <svg viewBox="0 0 280 120" className="absolute inset-0 h-full w-full">
        {prefs.edgeArrowEnabled && (
          <defs>
            <marker
              id="preview-arrow"
              viewBox="0 0 10 10"
              refX="8"
              refY="5"
              markerWidth={prefs.edgeArrowSize}
              markerHeight={prefs.edgeArrowSize}
              orient="auto-start-reverse"
            >
              <path d="M0 0 L10 5 L0 10 Z" fill={accent} />
            </marker>
          </defs>
        )}
        {prefs.flowStyle === 'gradient' && (
          <defs>
            <linearGradient id="live-grad" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor={accent} stopOpacity="0.2" />
              <stop offset="50%" stopColor={accent} stopOpacity="1" />
              <stop offset="100%" stopColor={accent} stopOpacity="0.2" />
              {animsOn && (
                <>
                  <animate
                    attributeName="x1"
                    values="-100%;0%;100%"
                    dur="1.6s"
                    repeatCount="indefinite"
                  />
                  <animate
                    attributeName="x2"
                    values="0%;100%;200%"
                    dur="1.6s"
                    repeatCount="indefinite"
                  />
                </>
              )}
            </linearGradient>
          </defs>
        )}
        <path
          id="livePath"
          d={path}
          stroke={prefs.flowStyle === 'gradient' ? 'url(#live-grad)' : accent}
          strokeWidth={strokeWidth}
          strokeDasharray={prefs.flowStyle === 'dashes' ? '6 7' : dashArray}
          fill="none"
          strokeLinecap="round"
          strokeLinejoin="round"
          markerEnd={prefs.edgeArrowEnabled ? 'url(#preview-arrow)' : undefined}
        >
          {prefs.flowStyle === 'pulse' && animsOn && (
            <>
              <animate
                attributeName="opacity"
                values="0.4;1;0.4"
                dur="1.8s"
                repeatCount="indefinite"
              />
              <animate
                attributeName="stroke-width"
                values={`${strokeWidth * 0.7};${strokeWidth * 1.8};${strokeWidth * 0.7}`}
                dur="1.8s"
                repeatCount="indefinite"
              />
            </>
          )}
          {prefs.flowStyle === 'dashes' && animsOn && (
            <animate
              attributeName="stroke-dashoffset"
              from="0"
              to="-26"
              dur="0.8s"
              repeatCount="indefinite"
            />
          )}
        </path>
        {prefs.flowStyle === 'orbs' && animsOn && (
          <circle r={prefs.flowParticleSize} fill={accent}>
            <animateMotion dur="1.8s" repeatCount="indefinite">
              <mpath href="#livePath" />
            </animateMotion>
          </circle>
        )}
        {prefs.flowStyle === 'comet' && animsOn && (
          <>
            <circle r={prefs.flowParticleSize * 0.7} fill={accent} opacity={0.3}>
              <animateMotion dur="1.8s" repeatCount="indefinite" begin="-0.25s">
                <mpath href="#livePath" />
              </animateMotion>
            </circle>
            <circle r={prefs.flowParticleSize * 0.85} fill={accent} opacity={0.6}>
              <animateMotion dur="1.8s" repeatCount="indefinite" begin="-0.12s">
                <mpath href="#livePath" />
              </animateMotion>
            </circle>
            <circle r={prefs.flowParticleSize} fill={accent}>
              <animateMotion dur="1.8s" repeatCount="indefinite">
                <mpath href="#livePath" />
              </animateMotion>
            </circle>
          </>
        )}
        {prefs.flowStyle === 'particles' &&
          animsOn &&
          Array.from({ length: prefs.flowParticleCount }).map((_, i) => (
            <circle key={i} r={prefs.flowParticleSize * 0.75} fill={accent}>
              <animateMotion
                dur="1.8s"
                repeatCount="indefinite"
                begin={`-${(i / prefs.flowParticleCount) * 1.8}s`}
              >
                <mpath href="#livePath" />
              </animateMotion>
            </circle>
          ))}
      </svg>
      <div
        className="absolute left-4 top-1/2"
        style={{ width: 56, transform: `translateY(-50%) scale(${prefs.nodeScale})` }}
      >
        <NodeStylePreview style={prefs.nodeStyle} accent={accent} />
      </div>
      <div
        className="absolute right-4 top-1/2"
        style={{ width: 56, transform: `translateY(-50%) scale(${prefs.nodeScale})` }}
      >
        <NodeStylePreview style={prefs.nodeStyle} accent={accent} />
      </div>
    </div>
  );
}

/** CSS background shorthand for the LivePreview's canvas. Kept inline
 *  so the preview stays one component; real editor background goes
 *  through GridLayer with SVG patterns (for zoom-awareness). */
export function bgLayer(pattern: BgPattern, size: number, opacity: number): string {
  if (pattern === 'none') return 'var(--app-bg)';
  if (pattern === 'dots') {
    return `radial-gradient(circle, rgba(128,130,132,${opacity}) 1px, transparent 1.5px) 0 0 / ${size}px ${size}px, var(--app-bg)`;
  }
  if (pattern === 'grid') {
    return `linear-gradient(rgba(128,130,132,${opacity * 0.5}) 1px, transparent 1px) 0 0 / ${size}px ${size}px, linear-gradient(90deg, rgba(128,130,132,${opacity * 0.5}) 1px, transparent 1px) 0 0 / ${size}px ${size}px, var(--app-bg)`;
  }
  return `repeating-linear-gradient(0deg, transparent 0, transparent ${size - 1}px, rgba(128,130,132,${opacity * 0.5}) ${size - 1}px, rgba(128,130,132,${opacity * 0.5}) ${size}px), var(--app-bg)`;
}

export function hexAlpha(hex: string, alpha: number): string {
  const h = hex.replace('#', '');
  const bigint = parseInt(
    h.length === 3
      ? h
          .split('')
          .map(c => c + c)
          .join('')
      : h,
    16
  );
  const r = (bigint >> 16) & 255;
  const g = (bigint >> 8) & 255;
  const b = bigint & 255;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}
