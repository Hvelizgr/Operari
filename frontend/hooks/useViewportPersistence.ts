'use client';

import { useOnViewportChange, useReactFlow, type Viewport } from '@xyflow/react';
import { useCallback, useEffect, useRef } from 'react';

import { useEditorStore } from '@/state/editorStore';

const VP_KEY = (id: string) => `operari:viewport:${id}`;

const isViewport = (raw: unknown): raw is Viewport =>
  typeof raw === 'object' &&
  raw !== null &&
  typeof (raw as Viewport).x === 'number' &&
  typeof (raw as Viewport).y === 'number' &&
  typeof (raw as Viewport).zoom === 'number';

const readStored = (runbookId: string): Viewport | null => {
  try {
    const raw = localStorage.getItem(VP_KEY(runbookId));
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return isViewport(parsed) ? parsed : null;
  } catch {
    return null;
  }
};

/**
 * Persists viewport (x, y, zoom) per runbook so an operator returning
 * to a 200-step runbook lands where they left off. On hydration we
 * restore the saved viewport if present, else fall back to fitView.
 *
 * The persistence key is per-runbookId so switching between runbooks
 * doesn't leak viewport across documents.
 */
export function useViewportPersistence() {
  const { setViewport, fitView } = useReactFlow();
  const runbookId = useEditorStore(s => s.runbookId);
  const status = useEditorStore(s => s.status);
  const restoredFor = useRef<string | null>(null);

  // Save on every settled viewport change. RF's `onEnd` fires after pan
  // / zoom completes, so we don't thrash localStorage during a drag.
  const onEnd = useCallback(
    (vp: Viewport) => {
      if (!runbookId) return;
      try {
        localStorage.setItem(VP_KEY(runbookId), JSON.stringify(vp));
      } catch {
        // Storage quota or private mode — best-effort.
      }
    },
    [runbookId]
  );
  useOnViewportChange({ onEnd });

  // Restore once per runbook hydration (or fall back to fitView).
  useEffect(() => {
    if (!runbookId) return;
    if (status !== 'idle' && status !== 'saved') return;
    if (restoredFor.current === runbookId) return;
    restoredFor.current = runbookId;
    const stored = readStored(runbookId);
    if (stored) {
      setViewport(stored, { duration: 0 });
    } else {
      // Defer to next frame so RF has measured nodes before we fit.
      requestAnimationFrame(() => fitView({ padding: 0.2, duration: 200 }));
    }
  }, [runbookId, status, setViewport, fitView]);
}
