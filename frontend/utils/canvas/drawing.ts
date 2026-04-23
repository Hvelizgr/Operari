import type { PortDirection } from '../nodePortUtils';
import { colorWithAlpha } from './color';
import {
  buildStepSegments,
  getBezierPoint,
  getControlPoints,
  lerpSegments,
  type OrientedPoint,
  type Point,
} from './geometry';
import type { RenderPrefs, UpstreamStatus } from './prefs';

/**
 * Canvas drawing primitives + the edge rendering pipeline.
 * Stateless — each call takes a fresh CanvasRenderingContext2D and
 * does all its work inside save/restore pairs so the caller's state
 * is never clobbered.
 */

interface DrawEdgeOptions {
  isCyclic?: boolean;
  /** Shared phase 0..1 that advances each frame. `undefined` means
   *  the line has no active flow (idle connection). */
  flow?: number;
  /** For RUNNING state: an additional marching-dash offset. Legacy
   *  behavior — layered on top of the flowStyle=`dashes` animation. */
  dashOffset?: number;
  upstreamStatus?: UpstreamStatus;
}

export function drawSmartBezier(
  ctx: CanvasRenderingContext2D,
  start: OrientedPoint,
  end: OrientedPoint,
  prefs: RenderPrefs,
  options: DrawEdgeOptions = {}
): void {
  const { cp1, cp2 } = getControlPoints(start, end);
  const { lineStyle, flowStyle } = prefs;

  // Line color: status-aware, with per-status overrides coming from
  // the user's Appearance prefs. Falls back to the built-in palette.
  let strokeColor = prefs.idleColor;
  if (options.isCyclic) {
    strokeColor = '#ef4444';
  } else if (options.upstreamStatus === 'RUNNING') {
    strokeColor = prefs.statusColor.RUNNING;
  } else if (options.upstreamStatus === 'SUCCESS') {
    strokeColor = prefs.statusColor.SUCCESS;
  } else if (options.upstreamStatus === 'FAILED') {
    strokeColor = prefs.statusColor.FAILED;
  }

  // Build the path once so stroke + orb traversal share the same waypoints.
  // For `step` we use an axis-aligned 3-segment elbow so flow orbs travel
  // predictably along the visible geometry instead of an imaginary bezier.
  const stepSegments = lineStyle === 'step' ? buildStepSegments(start, end) : null;

  const isRunning = options.upstreamStatus === 'RUNNING';
  const hasActiveFlow = options.flow !== undefined;

  // Pulse modulates line opacity + width with the shared flow phase so
  // *all* running lines breathe in sync.
  let pulseAlpha = 1;
  let pulseWidthBoost = 0;
  if (flowStyle === 'pulse' && hasActiveFlow) {
    const phase = (Math.sin(options.flow! * Math.PI * 2) + 1) / 2;
    pulseAlpha = 0.55 + phase * 0.45;
    pulseWidthBoost = phase * 0.8;
  }

  // Draw Line — user-configurable thickness, with a running boost so
  // the user can pick thin lines for aesthetics and the RUNNING state
  // still reads as "heavier" visually.
  ctx.save();
  // Idle opacity only applies when we're drawing an idle line (no
  // upstream status + no active flow). Running/success/failed strokes
  // rely on their own saturated colors.
  const isIdleLine = !options.upstreamStatus && !hasActiveFlow && !options.isCyclic;
  ctx.strokeStyle = strokeColor;
  ctx.globalAlpha = isIdleLine ? prefs.edgeIdleOpacity : pulseAlpha;
  ctx.lineWidth = (isRunning ? prefs.edgeThickness + 0.4 : prefs.edgeThickness) + pulseWidthBoost;
  if (options.isCyclic) {
    ctx.shadowBlur = 8;
    ctx.shadowColor = 'rgba(239, 68, 68, 0.7)';
  } else if (isRunning) {
    ctx.shadowBlur = 6;
    ctx.shadowColor = colorWithAlpha(strokeColor, 0.45);
  }
  ctx.beginPath();
  ctx.moveTo(start.x, start.y);

  // Dash resolution: active marching dashes on RUNNING always win;
  // after that, the `dashes` flow flavor; after that, the user's
  // idle dash pattern pref.
  const useFlowDashes = hasActiveFlow && flowStyle === 'dashes';
  if (isRunning && options.dashOffset !== undefined) {
    ctx.setLineDash([6, 4]);
    ctx.lineDashOffset = -options.dashOffset;
  } else if (useFlowDashes && options.flow !== undefined) {
    ctx.setLineDash([5, 6]);
    ctx.lineDashOffset = -options.flow * 22;
  } else if (options.dashOffset !== undefined) {
    ctx.setLineDash([5, 5]);
    ctx.lineDashOffset = -options.dashOffset;
  } else {
    applyIdleDashPattern(ctx, prefs.edgeDashPattern);
  }

  if (lineStyle === 'straight') {
    ctx.lineTo(end.x, end.y);
  } else if (stepSegments) {
    for (const seg of stepSegments) ctx.lineTo(seg.x, seg.y);
  } else {
    ctx.bezierCurveTo(cp1.x, cp1.y, cp2.x, cp2.y, end.x, end.y);
  }

  // For `gradient` flow we stroke the same path twice: a dim base,
  // then a short bright segment that slides along via a moving
  // linearGradient.
  if (flowStyle === 'gradient' && hasActiveFlow) {
    // Base stroke, dimmed.
    ctx.save();
    ctx.globalAlpha = 0.35;
    ctx.stroke();
    ctx.restore();
    // Moving gradient — can't use SVG-style gradients on a bezier
    // directly, so approximate with a linear gradient aligned along
    // the bounding box and slide it by offsetting the stops via the
    // flow phase.
    const gradient = ctx.createLinearGradient(start.x, start.y, end.x, end.y);
    const t = options.flow! % 1;
    const clamped = (v: number) => Math.max(0, Math.min(1, v));
    gradient.addColorStop(clamped(t - 0.25), colorWithAlpha(strokeColor, 0));
    gradient.addColorStop(clamped(t), strokeColor);
    gradient.addColorStop(clamped(t + 0.25), colorWithAlpha(strokeColor, 0));
    ctx.save();
    ctx.strokeStyle = gradient;
    ctx.lineWidth = ctx.lineWidth + 1;
    ctx.stroke();
    ctx.restore();
  } else {
    ctx.stroke();
  }
  ctx.restore();

  // Arrow head at the target end — tiny triangle aligned with the
  // incoming direction, painted in the same stroke color.
  if (prefs.edgeArrowEnabled) {
    drawArrowHead(
      ctx,
      end,
      prefs.edgeArrowSize,
      strokeColor,
      isIdleLine ? prefs.edgeIdleOpacity : 1
    );
  }

  // Flow particles. Only rendered when flow animation is active AND
  // upstream is RUNNING / SUCCESS so a static idle line has zero
  // per-frame cost.
  if (
    hasActiveFlow &&
    flowStyle !== 'dashes' &&
    flowStyle !== 'pulse' &&
    flowStyle !== 'gradient' &&
    flowStyle !== 'off'
  ) {
    const resolvePos = (tt: number) =>
      stepSegments
        ? lerpSegments([start, ...stepSegments], tt)
        : lineStyle === 'straight'
          ? {
              x: start.x + (end.x - start.x) * tt,
              y: start.y + (end.y - start.y) * tt,
            }
          : getBezierPoint(tt, start, cp1, cp2, end);
    const orbColor = strokeColor;
    const baseT = options.flow! % 1;
    const baseRadius = isRunning ? prefs.particleSize : prefs.particleSize * 0.75;

    if (flowStyle === 'orbs') {
      if (baseT >= 0.05 && baseT <= 0.95) {
        paintOrb(ctx, resolvePos(baseT), baseRadius, orbColor, 1);
      }
    } else if (flowStyle === 'comet') {
      // Head + 3 trailing ghosts with decreasing alpha/radius —
      // reads as a comet tail, not a sequence of orbs.
      for (let i = 0; i < 4; i++) {
        const tt = (baseT - i * 0.04 + 1) % 1;
        if (tt < 0.05 || tt > 0.95) continue;
        const alpha = 1 - i * 0.25;
        const radius = baseRadius * (1 - i * 0.18);
        paintOrb(ctx, resolvePos(tt), radius, orbColor, alpha);
      }
    } else if (flowStyle === 'particles') {
      const count = Math.max(1, Math.floor(prefs.particleCount));
      for (let i = 0; i < count; i++) {
        const tt = (baseT + i / count) % 1;
        if (tt < 0.05 || tt > 0.95) continue;
        paintOrb(ctx, resolvePos(tt), baseRadius * 0.8, orbColor, 0.9);
      }
    }
  }
}

function paintOrb(
  ctx: CanvasRenderingContext2D,
  pos: Point,
  radius: number,
  color: string,
  alpha: number
): void {
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.fillStyle = color;
  ctx.shadowBlur = 8;
  ctx.shadowColor = colorWithAlpha(color, 0.9);
  ctx.beginPath();
  ctx.arc(pos.x, pos.y, radius, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawArrowHead(
  ctx: CanvasRenderingContext2D,
  end: OrientedPoint,
  size: number,
  color: string,
  alpha: number
): void {
  // Arrow points toward the target port (i.e. AWAY from its entry
  // direction). If the target port is a `left` port, the arrow
  // points leftward — reverse the direction vector.
  const dirVec = directionVector(end.direction);
  const inX = -dirVec.x;
  const inY = -dirVec.y;
  // Build a triangle with the tip at `end` and the base `size` px
  // back along the incoming direction.
  const backX = end.x - inX * size;
  const backY = end.y - inY * size;
  const perpX = -inY; // rotate 90°
  const perpY = inX;
  const halfWidth = size * 0.6;
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(end.x, end.y);
  ctx.lineTo(backX + perpX * halfWidth, backY + perpY * halfWidth);
  ctx.lineTo(backX - perpX * halfWidth, backY - perpY * halfWidth);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

function directionVector(direction: PortDirection): Point {
  switch (direction) {
    case 'left':
      return { x: -1, y: 0 };
    case 'right':
      return { x: 1, y: 0 };
    case 'top':
      return { x: 0, y: -1 };
    case 'bottom':
      return { x: 0, y: 1 };
  }
}

function applyIdleDashPattern(
  ctx: CanvasRenderingContext2D,
  pattern: RenderPrefs['edgeDashPattern']
): void {
  switch (pattern) {
    case 'dotted':
      ctx.setLineDash([1, 4]);
      break;
    case 'short-dash':
      ctx.setLineDash([4, 4]);
      break;
    case 'long-dash':
      ctx.setLineDash([10, 6]);
      break;
    case 'solid':
    default:
      ctx.setLineDash([]);
  }
}
