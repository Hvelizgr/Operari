'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';

const STORAGE_KEY = 'operari:favorite-types';

const readStored = (): string[] => {
  if (typeof localStorage === 'undefined') return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((s): s is string => typeof s === 'string') : [];
  } catch {
    return [];
  }
};

const writeStored = (types: string[]): void => {
  if (typeof localStorage === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(types));
  } catch {
    // Quota / private mode — best-effort.
  }
};

/**
 * Per-user favorites for step types, persisted to localStorage. The
 * search palette and pane-node menu surface favorites at the top so
 * the operator's most-used types are one keystroke away.
 *
 * Inspired by chaiNNer's `useNodeFavorites` (renderer/hooks).
 */
export interface UseFavorites {
  readonly favorites: ReadonlySet<string>;
  readonly isFavorite: (type: string) => boolean;
  readonly toggle: (type: string) => void;
}

export function useFavorites(): UseFavorites {
  // Stored as an array on disk; held as a Set in memory for O(1) lookup.
  const [types, setTypes] = useState<string[]>([]);

  // Read once on mount; SSR-safe because `readStored` no-ops when
  // `localStorage` is undefined.
  useEffect(() => {
    setTypes(readStored());
  }, []);

  const favorites = useMemo(() => new Set(types), [types]);

  const toggle = useCallback((type: string) => {
    setTypes(prev => {
      const next = prev.includes(type) ? prev.filter(t => t !== type) : [...prev, type];
      writeStored(next);
      return next;
    });
  }, []);

  const isFavorite = useCallback((type: string) => favorites.has(type), [favorites]);

  return { favorites, isFavorite, toggle };
}
