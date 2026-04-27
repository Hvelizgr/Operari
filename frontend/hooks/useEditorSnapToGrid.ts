import { useCallback, useState } from 'react';

const STORAGE_KEY = 'operari-editor-snap-to-grid';

/** Grid size in canvas-space pixels. The existing runbooks were
 *  authored with loose positions; 20px is the smallest snap that
 *  visually implies "aligned" without making small manual tweaks
 *  impossible. */
export const SNAP_GRID_PX = 20;

/**
 * Snap-to-grid preference for node dragging.
 *
 * Persisted in localStorage so the operator's choice survives reloads.
 * Default off because the existing runbooks were authored without snap
 * and force-snapping them on first edit would shuffle layouts a user
 * already approved.
 */
export function useEditorSnapToGrid() {
  const [snapToGrid, setSnapToGrid] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    return localStorage.getItem(STORAGE_KEY) === '1';
  });

  const toggleSnapToGrid = useCallback(() => {
    setSnapToGrid(prev => {
      const next = !prev;
      try {
        localStorage.setItem(STORAGE_KEY, next ? '1' : '0');
      } catch {
        /* noop — localStorage blocked; preference lasts this session */
      }
      return next;
    });
  }, []);

  return { snapToGrid, toggleSnapToGrid };
}
