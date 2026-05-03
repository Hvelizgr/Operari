'use client';

/**
 * Plus-button extension for an unconnected output handle (n8n parity).
 *
 * The visible Handle dot is ~8px which is hostile to operators trying
 * to start a connection — even with the surrounding hit-zone padding
 * the target is small. n8n solves this by drawing a 46-80px line
 * extending OUT from the handle, ending in a 24x24 plus button.
 * The plus button is the actual hit target, ~9× the area of the dot,
 * AND it doubles as a "click to add the next step" affordance.
 *
 * Visibility rules:
 *   - Hidden when the port already has at least one outgoing edge
 *     (the handle dot is enough — no need to compete with the edge).
 *   - Hidden in embed mode (read-only viewer).
 *   - Hidden while another node is being drag-connected (we don't
 *     want a stray plus button stealing the cursor target).
 *
 * Click → dispatches a `operari:request-node-add` window event that
 * Canvas.tsx listens to and opens the existing `PaneNodeMenu` at the
 * cursor position — same affordance as drop-edge-into-empty-space,
 * just initiated by a click instead of a drag. The event payload
 * carries the source node id + handle id so the picker creates the
 * new node already wired to this port.
 *
 * The line + plus is rendered as inline SVG inside an absolutely
 * positioned wrapper that anchors to the handle's vertical position
 * (caller passes `topPercent` so a 3-output node spaces them at
 * 25/50/75% just like the handles). `pointer-events-none` on the
 * line so only the plus is clickable; the rest of the canvas can
 * still receive drag events through the empty pixels.
 */

interface HandlePlusExtensionProps {
  /** Source node id. Forwarded in the dispatch payload. */
  sourceNodeId: string;
  /** Output port index (string for compatibility with React Flow's
   *  Handle.id contract). */
  sourceHandle: string;
  /** Vertical position relative to the host node, expressed as a CSS
   *  percentage (e.g. "50%"). Mirrors the matching Handle's `top`
   *  so the line stays aligned. */
  topPercent: string;
  /** Optional accent color override — passes through to the plus
   *  button stroke + line. Default uses the moss accent. */
  tone?: string;
}

const LINE_LENGTH = 46;
const PLUS_SIZE = 22;

export default function HandlePlusExtension({
  sourceNodeId,
  sourceHandle,
  topPercent,
  tone,
}: HandlePlusExtensionProps) {
  const stroke = tone ?? 'color-mix(in oklab, var(--op-moss, #3ecf8e) 60%, transparent)';
  const onClick = (event: React.MouseEvent) => {
    event.stopPropagation();
    // Dispatch via a window event so Canvas.tsx (which owns the
    // PaneNodeMenu state) is the single owner of "open the picker".
    // Avoids prop-drilling a callback through the node renderer.
    window.dispatchEvent(
      new CustomEvent('operari:request-node-add', {
        detail: {
          sourceNodeId,
          sourceHandle,
          screenX: event.clientX,
          screenY: event.clientY,
        },
      })
    );
  };

  // The wrapper sits to the RIGHT of the node bounds. Width = line +
  // plus, so the plus button's right edge is at LINE+PLUS px past the
  // node's right edge. translateY(-50%) centres the SVG on its
  // computed `top`. The whole element is `pointer-events: none` so
  // only the plus group inside the SVG receives clicks — the line
  // above the SVG is decoration.
  return (
    <div
      data-handle-plus-wrapper
      className="pointer-events-none absolute z-10"
      style={{
        right: `-${LINE_LENGTH + PLUS_SIZE + 4}px`,
        top: topPercent,
        transform: 'translateY(-50%)',
      }}
      aria-hidden="true"
    >
      <svg
        width={LINE_LENGTH + PLUS_SIZE}
        height={PLUS_SIZE}
        viewBox={`0 0 ${LINE_LENGTH + PLUS_SIZE} ${PLUS_SIZE}`}
        className="overflow-visible"
      >
        <line
          x1={0}
          y1={PLUS_SIZE / 2}
          x2={LINE_LENGTH}
          y2={PLUS_SIZE / 2}
          stroke={stroke}
          strokeWidth={1.5}
          strokeLinecap="round"
        />
        <g
          className="rb-handle-plus-button cursor-pointer"
          transform={`translate(${LINE_LENGTH}, 0)`}
          onClick={onClick}
          style={{ pointerEvents: 'auto' }}
        >
          <rect
            x={0}
            y={0}
            width={PLUS_SIZE}
            height={PLUS_SIZE}
            rx={5}
            fill="var(--rb-node-bg, #1a1a2e)"
            stroke={stroke}
            strokeWidth={1.5}
          />
          <path
            d={`M ${PLUS_SIZE / 2 - 5} ${PLUS_SIZE / 2} h 10 M ${PLUS_SIZE / 2} ${PLUS_SIZE / 2 - 5} v 10`}
            stroke="var(--op-moss, #3ecf8e)"
            strokeWidth={1.5}
            strokeLinecap="round"
          />
        </g>
      </svg>
    </div>
  );
}
