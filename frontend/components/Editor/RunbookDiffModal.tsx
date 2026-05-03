'use client';

import * as DialogPrimitive from '@radix-ui/react-dialog';
import { DiffModeEnum, DiffView } from '@git-diff-view/react';
import '@git-diff-view/react/styles/diff-view.css';
import { ArrowLeftRight, GitCommitVertical, Loader2 } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';

import { formatDateTime } from '@/lib/datetime';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

/**
 * Runbook version diff viewer — Sprint 5 entry.
 *
 * Powered by `@git-diff-view/react`. Pulls the version list from
 * `GET /api/runbooks/:id/versions`, lets the operator pick two
 * versions (defaults: latest + the one before), then renders both
 * YAMLs side-by-side via the `DiffView` component.
 *
 * Why YAML and not the JSON snapshot directly: YAML is what the
 * operator already reads in `YamlViewModal`, so the diff matches the
 * mental model of "what changed between save A and save B" without
 * surfacing JSON noise (key ordering, trailing commas, etc).
 *
 * The component never mutates anything — read-only viewer. A future
 * "rollback to this version" button is a separate ADR.
 */

interface RunbookDiffModalProps {
  runbookId: string;
  open: boolean;
  onClose: () => void;
  lang: 'en' | 'es';
}

interface VersionRow {
  id: string;
  version: number;
  createdAt: string;
  createdByUserId: string | null;
}

export function RunbookDiffModal({ runbookId, open, onClose, lang }: RunbookDiffModalProps) {
  const [versions, setVersions] = useState<VersionRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [oldId, setOldId] = useState<string | null>(null);
  const [newId, setNewId] = useState<string | null>(null);
  const [oldYaml, setOldYaml] = useState<string | null>(null);
  const [newYaml, setNewYaml] = useState<string | null>(null);
  const [loadingDiff, setLoadingDiff] = useState(false);
  const [mode, setMode] = useState<DiffModeEnum>(DiffModeEnum.Split);

  const t =
    lang === 'es'
      ? {
          title: 'Comparar versiones',
          hint: 'Elegí dos snapshots persistidos para ver qué cambió. La comparación es sobre el YAML serializado — el mismo formato de la vista YAML.',
          old: 'Versión anterior',
          new: 'Versión nueva',
          loading: 'Cargando…',
          loadFailed: 'No se pudieron cargar las versiones',
          diffFailed: 'No se pudo cargar el diff',
          empty: 'Este runbook todavía no tiene versiones persistidas.',
          identical: 'Las dos versiones son idénticas.',
          split: 'Lado a lado',
          unified: 'Unificado',
          close: 'Cerrar',
          version: 'Versión',
        }
      : {
          title: 'Compare versions',
          hint: 'Pick two persisted snapshots to see what changed. The comparison is over the serialised YAML — the same format the YAML view shows.',
          old: 'Old version',
          new: 'New version',
          loading: 'Loading…',
          loadFailed: 'Could not load versions',
          diffFailed: 'Could not load diff',
          empty: 'This runbook has no persisted versions yet.',
          identical: 'The two versions are identical.',
          split: 'Split',
          unified: 'Unified',
          close: 'Close',
          version: 'Version',
        };

  // Fetch the version list when the modal opens.
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setError(null);
    setVersions(null);
    fetch(`${API_BASE}/api/runbooks/${runbookId}/versions`, { credentials: 'include' })
      .then(r => (r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`))))
      .then((body: { data?: VersionRow[] }) => {
        if (cancelled) return;
        const list = body.data ?? [];
        setVersions(list);
        // Defaults: latest + the version before. The first time a
        // runbook has only one version, we leave both selectors on
        // the same id so the diff renders empty (and we show the
        // identical-versions hint instead of a confusing red wash).
        if (list.length >= 2) {
          setNewId(list[0].id);
          setOldId(list[1].id);
        } else if (list.length === 1) {
          setNewId(list[0].id);
          setOldId(list[0].id);
        }
      })
      .catch(err => {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : t.loadFailed);
      });
    return () => {
      cancelled = true;
    };
  }, [open, runbookId, t.loadFailed]);

  // Fetch both YAMLs whenever the selection changes. We do them in
  // parallel — they're independent and small.
  useEffect(() => {
    if (!oldId || !newId) return;
    let cancelled = false;
    setLoadingDiff(true);
    Promise.all([
      fetch(`${API_BASE}/api/runbooks/${runbookId}/versions/${oldId}/yaml`, {
        credentials: 'include',
      }).then(r => (r.ok ? r.text() : Promise.reject(new Error(`HTTP ${r.status}`)))),
      fetch(`${API_BASE}/api/runbooks/${runbookId}/versions/${newId}/yaml`, {
        credentials: 'include',
      }).then(r => (r.ok ? r.text() : Promise.reject(new Error(`HTTP ${r.status}`)))),
    ])
      .then(([oldText, newText]) => {
        if (cancelled) return;
        setOldYaml(oldText);
        setNewYaml(newText);
        setError(null);
      })
      .catch(err => {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : t.diffFailed);
      })
      .finally(() => {
        if (!cancelled) setLoadingDiff(false);
      });
    return () => {
      cancelled = true;
    };
  }, [oldId, newId, runbookId, t.diffFailed]);

  const data = useMemo(() => {
    if (oldYaml == null || newYaml == null) return undefined;
    return {
      oldFile: { fileName: 'previous.yaml', fileLang: 'yaml', content: oldYaml },
      newFile: { fileName: 'current.yaml', fileLang: 'yaml', content: newYaml },
      hunks: [],
    };
  }, [oldYaml, newYaml]);

  const swap = useCallback(() => {
    setOldId(prevOld => {
      const prevNew = newId;
      setNewId(prevOld);
      return prevNew;
    });
  }, [newId]);

  const isIdentical = oldYaml != null && newYaml != null && oldYaml === newYaml;

  return (
    <DialogPrimitive.Root open={open} onOpenChange={o => !o && onClose()}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="data-[state=closed]:animate-out data-[state=open]:animate-in data-[state=closed]:fade-out data-[state=open]:fade-in fixed inset-0 z-50 bg-black/60 backdrop-blur-sm" />
        <DialogPrimitive.Content className="data-[state=closed]:animate-out data-[state=open]:animate-in data-[state=closed]:fade-out data-[state=open]:fade-in data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 fixed left-1/2 top-1/2 z-50 flex max-h-[88vh] w-[min(1100px,calc(100vw-2rem))] -translate-x-1/2 -translate-y-1/2 flex-col rounded-xl border border-zinc-700 bg-zinc-900 shadow-2xl">
          <div className="flex items-start justify-between gap-3 border-b border-zinc-800 px-4 py-3">
            <div>
              <DialogPrimitive.Title className="flex items-center gap-2 text-sm font-semibold text-zinc-100">
                <GitCommitVertical size={14} className="text-emerald-400" />
                {t.title}
              </DialogPrimitive.Title>
              <DialogPrimitive.Description className="mt-1 text-[11px] text-zinc-500">
                {t.hint}
              </DialogPrimitive.Description>
            </div>
            <div className="flex items-center gap-1 rounded border border-zinc-700 p-0.5">
              <button
                type="button"
                onClick={() => setMode(DiffModeEnum.Split)}
                className={`rounded px-2 py-0.5 text-[11px] transition-colors ${
                  mode === DiffModeEnum.Split
                    ? 'bg-zinc-700 text-zinc-100'
                    : 'text-zinc-400 hover:text-zinc-200'
                }`}
              >
                {t.split}
              </button>
              <button
                type="button"
                onClick={() => setMode(DiffModeEnum.Unified)}
                className={`rounded px-2 py-0.5 text-[11px] transition-colors ${
                  mode === DiffModeEnum.Unified
                    ? 'bg-zinc-700 text-zinc-100'
                    : 'text-zinc-400 hover:text-zinc-200'
                }`}
              >
                {t.unified}
              </button>
            </div>
          </div>

          {versions == null ? (
            <div className="flex flex-1 items-center justify-center p-8 text-xs text-zinc-500">
              <Loader2 size={14} className="mr-2 animate-spin" />
              {t.loading}
            </div>
          ) : versions.length === 0 ? (
            <div className="flex flex-1 items-center justify-center p-8 text-xs text-zinc-500">
              {t.empty}
            </div>
          ) : (
            <>
              <div className="flex flex-wrap items-end gap-3 border-b border-zinc-800 px-4 py-3">
                <label className="flex flex-col gap-1 text-[11px] text-zinc-400">
                  <span className="font-mono uppercase tracking-wider">{t.old}</span>
                  <select
                    value={oldId ?? ''}
                    onChange={e => setOldId(e.target.value)}
                    className="rounded border border-zinc-700 bg-zinc-800 px-2 py-1 text-xs text-zinc-100 focus:border-emerald-500 focus:outline-none"
                  >
                    {versions.map(v => (
                      <option key={v.id} value={v.id}>
                        {t.version} {v.version} · {formatDateTime(v.createdAt, lang)}
                      </option>
                    ))}
                  </select>
                </label>
                <button
                  type="button"
                  onClick={swap}
                  className="mb-0.5 inline-flex items-center gap-1 rounded border border-zinc-700 px-2 py-1 text-[11px] text-zinc-300 transition-colors hover:bg-zinc-800"
                  title={lang === 'es' ? 'Invertir' : 'Swap'}
                >
                  <ArrowLeftRight size={11} />
                </button>
                <label className="flex flex-col gap-1 text-[11px] text-zinc-400">
                  <span className="font-mono uppercase tracking-wider">{t.new}</span>
                  <select
                    value={newId ?? ''}
                    onChange={e => setNewId(e.target.value)}
                    className="rounded border border-zinc-700 bg-zinc-800 px-2 py-1 text-xs text-zinc-100 focus:border-emerald-500 focus:outline-none"
                  >
                    {versions.map(v => (
                      <option key={v.id} value={v.id}>
                        {t.version} {v.version} · {formatDateTime(v.createdAt, lang)}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              <div className="min-h-0 flex-1 overflow-auto bg-zinc-950">
                {error && (
                  <div className="m-3 rounded border border-rose-500/40 bg-rose-500/10 px-3 py-2 text-xs text-rose-300">
                    {error}
                  </div>
                )}
                {loadingDiff ? (
                  <div className="flex h-full items-center justify-center text-xs text-zinc-500">
                    <Loader2 size={14} className="mr-2 animate-spin" />
                    {t.loading}
                  </div>
                ) : isIdentical ? (
                  <div className="flex h-full items-center justify-center text-xs text-zinc-500">
                    {t.identical}
                  </div>
                ) : data ? (
                  <DiffView data={data} diffViewMode={mode} diffViewWrap={false} />
                ) : null}
              </div>
            </>
          )}

          <div className="flex justify-end gap-2 border-t border-zinc-800 px-4 py-3">
            <button
              type="button"
              onClick={onClose}
              className="rounded border border-zinc-700 px-3 py-1 text-xs text-zinc-300 transition-colors hover:bg-zinc-800"
            >
              {t.close}
            </button>
          </div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
