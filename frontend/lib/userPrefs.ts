'use client';

import { useCallback, useEffect, useState } from 'react';

import { storageRead, storageWrite } from './storage-compat';

/**
 * Per-feature user preferences stored in localStorage.
 *
 * Each section (sql, api, editor, lineage) owns its own key + shape.
 * The hooks below give consumer components a `[prefs, setPrefs]`
 * pair where `setPrefs` writes through to localStorage and notifies
 * other tabs / hook instances via a `storage` event.
 *
 * Defaults live alongside each shape so the feature still works on
 * first load before any setting has been touched. Unknown stored
 * keys are merged on read so adding a new pref later doesn't strand
 * users on a stale config.
 */

// =============================================================================
// SQL editor
// =============================================================================

export interface SqlPrefs {
  defaultRowLimit: number;
  confirmDestructive: boolean;
  queryTimeoutMs: number;
  autoLoadSchema: boolean;
  showSystemSchemas: boolean;
  diagramLayoutDirection: 'RIGHT' | 'DOWN';
  diagramDefaultZoom: 'fit' | '1x';
  tabSize: 2 | 4;
  autoFormatOnRun: boolean;
  showRowNumbers: boolean;
}

export const SQL_PREFS_DEFAULTS: SqlPrefs = {
  defaultRowLimit: 1000,
  confirmDestructive: true,
  queryTimeoutMs: 30_000,
  autoLoadSchema: true,
  showSystemSchemas: false,
  diagramLayoutDirection: 'RIGHT',
  diagramDefaultZoom: 'fit',
  tabSize: 2,
  autoFormatOnRun: false,
  showRowNumbers: true,
};

const SQL_KEY = 'operari:prefs:sql';

// =============================================================================
// API tester
// =============================================================================

export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE' | 'HEAD';

export interface ApiPrefs {
  defaultTimeoutMs: number;
  prettyPrintJson: boolean;
  showResponseHeaders: boolean;
  historyCap: number;
  defaultMethod: HttpMethod;
  defaultContentType: string;
  defaultAcceptHeader: string;
  preserveCookies: boolean;
  followRedirects: boolean;
  allowSelfSignedCerts: boolean;
}

export const API_PREFS_DEFAULTS: ApiPrefs = {
  defaultTimeoutMs: 30_000,
  prettyPrintJson: true,
  showResponseHeaders: false,
  historyCap: 50,
  defaultMethod: 'GET',
  defaultContentType: 'application/json',
  defaultAcceptHeader: 'application/json',
  preserveCookies: false,
  followRedirects: true,
  allowSelfSignedCerts: false,
};

const API_KEY = 'operari:prefs:api';

// =============================================================================
// Runbook editor
// =============================================================================

export interface EditorPrefs {
  /** Autosave debounce in ms. */
  autosaveIntervalMs: number;
  /** Modal before deleting nodes/edges with Backspace/Delete. */
  confirmDelete: boolean;
  /** Where new nodes drop when dragged from the palette without a
   *  pointer location (e.g. via the search palette). */
  newNodePosition: 'center' | 'cursor' | 'next-to-selected';
  /** Snap-to-grid step size in px. 0 = no snap. */
  snapStep: 0 | 10 | 20 | 40;
  /** When loading a runbook, fit the viewport to show every node. */
  autoFitOnLoad: boolean;
  /** "Show stats" toolbar toggle starts on. */
  showStatsByDefault: boolean;
}

export const EDITOR_PREFS_DEFAULTS: EditorPrefs = {
  autosaveIntervalMs: 2000,
  confirmDelete: false,
  newNodePosition: 'center',
  snapStep: 20,
  autoFitOnLoad: true,
  showStatsByDefault: false,
};

const EDITOR_KEY = 'operari:prefs:editor';

// =============================================================================
// Lineage page
// =============================================================================

export interface LineagePrefs {
  /** Cluster runbooks by their `category` column. */
  groupByCategory: boolean;
  /** Hide on-error edges (only show explicit `runbook` step calls). */
  hideOnErrorEdges: boolean;
  /** Hide per-step hook edges (hook-success + hook-failure). Useful
   *  when a workspace has many hook-heavy runbooks and the operator
   *  wants the call graph without the recovery-path overlay. */
  hideHookEdges: boolean;
}

export const LINEAGE_PREFS_DEFAULTS: LineagePrefs = {
  groupByCategory: false,
  hideOnErrorEdges: false,
  hideHookEdges: false,
};

const LINEAGE_KEY = 'operari:prefs:lineage';

// =============================================================================
// Compute defaults (machine presets, TTL, retries)
// =============================================================================

/** Mirror of backend MachinePresetName — kept narrow on purpose so a
 *  typo in the prefs panel doesn't silently fall through to the
 *  `small-1x` fallback at run time. */
export type MachinePresetName =
  | 'micro'
  | 'small-1x'
  | 'small-2x'
  | 'medium-1x'
  | 'medium-2x'
  | 'large-1x'
  | 'large-2x';

export interface ComputePrefs {
  /** Default `machine:` value applied when a runbook trigger / new
   *  step doesn't specify one. Mirrors the backend's small-1x
   *  fallback so installing an Operari instance and never visiting
   *  Settings keeps the historical behaviour. */
  defaultMachine: MachinePresetName;
  /** Default TTL (seconds) seeded into the trigger dialog. 0 = no TTL. */
  defaultTtlSeconds: number;
  /** Default retry count seeded into new step retry policies. */
  defaultRetryCount: number;
  /** Whether the trigger dialog should default to dry-run mode. */
  defaultDryRun: boolean;
}

export const COMPUTE_PREFS_DEFAULTS: ComputePrefs = {
  defaultMachine: 'small-1x',
  defaultTtlSeconds: 0,
  defaultRetryCount: 0,
  defaultDryRun: false,
};

const COMPUTE_KEY = 'operari:prefs:compute';

// =============================================================================
// Hook factory
// =============================================================================

function readPrefs<T>(key: string, defaults: T): T {
  const raw = storageRead(key);
  if (!raw) return defaults;
  try {
    const parsed = JSON.parse(raw) as Partial<T>;
    return { ...defaults, ...parsed };
  } catch {
    return defaults;
  }
}

function writePrefs<T>(key: string, value: T): void {
  storageWrite(key, JSON.stringify(value));
  // `storage` events only fire across tabs; dispatch a custom one so
  // multiple `useUserPrefs` instances inside the same tab stay in
  // sync without a context provider.
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('operari:prefs', { detail: { key } }));
  }
}

function useStoredPrefs<T>(key: string, defaults: T): [T, (patch: Partial<T>) => void] {
  const [state, setState] = useState<T>(defaults);

  useEffect(() => {
    setState(readPrefs(key, defaults));
    const onUpdate = (e: Event) => {
      if (e instanceof StorageEvent && e.key === key) {
        setState(readPrefs(key, defaults));
      } else if (e instanceof CustomEvent && e.detail?.key === key) {
        setState(readPrefs(key, defaults));
      }
    };
    window.addEventListener('storage', onUpdate);
    window.addEventListener('operari:prefs', onUpdate as EventListener);
    return () => {
      window.removeEventListener('storage', onUpdate);
      window.removeEventListener('operari:prefs', onUpdate as EventListener);
    };
    // `defaults` is a module-level constant in every consumer so it
    // is stable for the lifetime of the app — including it in deps
    // would just trigger one extra effect run on first mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  const update = useCallback(
    (patch: Partial<T>) => {
      setState(prev => {
        const next = { ...prev, ...patch };
        writePrefs(key, next);
        return next;
      });
    },
    [key]
  );

  return [state, update];
}

export function useSqlPrefs(): [SqlPrefs, (patch: Partial<SqlPrefs>) => void] {
  return useStoredPrefs(SQL_KEY, SQL_PREFS_DEFAULTS);
}

export function useApiPrefs(): [ApiPrefs, (patch: Partial<ApiPrefs>) => void] {
  return useStoredPrefs(API_KEY, API_PREFS_DEFAULTS);
}

export function useEditorPrefs(): [EditorPrefs, (patch: Partial<EditorPrefs>) => void] {
  return useStoredPrefs(EDITOR_KEY, EDITOR_PREFS_DEFAULTS);
}

export function useLineagePrefs(): [LineagePrefs, (patch: Partial<LineagePrefs>) => void] {
  return useStoredPrefs(LINEAGE_KEY, LINEAGE_PREFS_DEFAULTS);
}

export function useComputePrefs(): [ComputePrefs, (patch: Partial<ComputePrefs>) => void] {
  return useStoredPrefs(COMPUTE_KEY, COMPUTE_PREFS_DEFAULTS);
}

/**
 * Read SQL prefs synchronously from a non-React caller (e.g. a fetch
 * callback). Returns the merged value with defaults so a fresh
 * install never sees `undefined` here.
 */
export function readSqlPrefs(): SqlPrefs {
  return readPrefs(SQL_KEY, SQL_PREFS_DEFAULTS);
}
export function readApiPrefs(): ApiPrefs {
  return readPrefs(API_KEY, API_PREFS_DEFAULTS);
}
export function readEditorPrefs(): EditorPrefs {
  return readPrefs(EDITOR_KEY, EDITOR_PREFS_DEFAULTS);
}
export function readComputePrefs(): ComputePrefs {
  return readPrefs(COMPUTE_KEY, COMPUTE_PREFS_DEFAULTS);
}
export function readLineagePrefs(): LineagePrefs {
  return readPrefs(LINEAGE_KEY, LINEAGE_PREFS_DEFAULTS);
}
