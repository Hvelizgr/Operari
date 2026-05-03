'use client';

import JsonView from '@uiw/react-json-view';
import { darkTheme } from '@uiw/react-json-view/dark';
import type { CSSProperties } from 'react';

/**
 * JsonInspect — thin wrapper around `@uiw/react-json-view` for the
 * editor's inspect bubbles + the HTTP tester response viewer.
 *
 * Why a wrapper: `JsonView` takes ~6 inline props every time you use
 * it (theme, style, font sizing, indentation, toggling features).
 * Centralising them keeps the inspect surfaces visually consistent
 * and lets us retune defaults from one place when feedback comes in.
 *
 * Defaults:
 *   - Read-only (no edit affordance shown)
 *   - Indent narrow (we run inside 240–320px node bodies)
 *   - Collapsed at depth 1 — for shallow values it stays open, for
 *     deep nested step outputs the operator clicks to drill in.
 *   - Dark palette merged with our zinc background so the bubble
 *     blends with `BaseStepNode`'s existing inspect chrome.
 */

interface JsonInspectProps {
  value: unknown;
  /** Optional override for collapse depth. Default 1. */
  collapseDepth?: number;
  /** Extra style overrides (max-height, custom bg). */
  style?: CSSProperties;
}

export function JsonInspect({ value, collapseDepth = 1, style }: JsonInspectProps) {
  // The lib only renders for objects/arrays. For scalars we fall
  // back to a plain pre so the bubble still shows something useful
  // ("Done", a number, a boolean) without an empty viewer.
  if (typeof value !== 'object' || value === null) {
    return (
      <pre
        className="m-0 whitespace-pre-wrap break-all font-mono text-[10px] text-zinc-300"
        style={style}
      >
        {String(value)}
      </pre>
    );
  }
  return (
    <JsonView
      value={value as object}
      collapsed={collapseDepth}
      enableClipboard
      shortenTextAfterLength={120}
      indentWidth={12}
      displayDataTypes={false}
      displayObjectSize
      style={{
        ...darkTheme,
        backgroundColor: 'transparent',
        fontSize: '10px',
        fontFamily: 'var(--font-mono, ui-monospace, monospace)',
        ...style,
      }}
    />
  );
}
