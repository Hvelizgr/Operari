// frontend/utils/portAnchor.ts
// Shared resolver for "where is this pole in logical canvas coords".
//
// Both useCanvasRenderer (bezier lines) and ConnectionBubblesLayer
// (midpoint condition bubbles) need the same anchor. If they disagreed
// — e.g. the line was anchored to the real DOM while the bubble still
// used formula math — the bubble drifts away from the midpoint of the
// line as soon as any shape-specific CSS offset sneaked into the pole
// position. Share one resolver so both surfaces always agree.

import type { WorkflowNode } from '@cairn/shared';

import { getNodePortInfo, type NodeWithDimensions, type PortInfo } from './nodePortUtils';

export interface PortAnchorContext {
  /** Parent element whose getBoundingClientRect defines logical 0,0. */
  canvasEl: HTMLElement | null;
  viewport: { x: number; y: number; zoom: number };
}

/**
 * Resolve a pole to logical canvas coordinates. Reads the real DOM
 * element first (robust against CSS drift), falls back to the math
 * formula when the DOM isn't mounted yet (first paint) or the pole is
 * collapsed by nano-mode.
 *
 * Returns {x, y, direction}. `direction` always comes from the math
 * resolver because the bezier drawing uses it to pick control-point
 * placement (and a trigger's output-right is semantically different
 * from a limit's output-bottom, regardless of DOM layout).
 */
export function resolvePortAnchor(
  node: WorkflowNode,
  portType: 'input' | 'output',
  portIndex: number,
  ctx: PortAnchorContext
): PortInfo {
  const math = getNodePortInfo(node as NodeWithDimensions, portType, portIndex);
  if (!ctx.canvasEl || typeof document === 'undefined') return math;

  const container = document.getElementById(`d_wfn_${node.id}`);
  if (!container) return math;

  const portClass = portType === 'input' ? 'wf_input_pole' : 'wf_output_pole';
  const altClass = portType === 'input' ? 'wf_up_pole' : 'wf_down_pole';
  const poles = container.querySelectorAll<HTMLElement>(`.${portClass}, .${altClass}`);
  const poleEl = poles[portIndex] ?? poles[0];
  if (!poleEl) return math;

  const poleRect = poleEl.getBoundingClientRect();
  if (poleRect.width === 0 || poleRect.height === 0) return math;

  const canvasRect = ctx.canvasEl.getBoundingClientRect();
  const cxScreen = poleRect.left + poleRect.width / 2 - canvasRect.left;
  const cyScreen = poleRect.top + poleRect.height / 2 - canvasRect.top;
  return {
    x: (cxScreen - ctx.viewport.x) / ctx.viewport.zoom,
    y: (cyScreen - ctx.viewport.y) / ctx.viewport.zoom,
    direction: math.direction,
  };
}
