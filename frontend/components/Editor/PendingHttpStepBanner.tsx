'use client';

import { ArrowRightToLine, X } from 'lucide-react';
import { useEffect, useState } from 'react';

const PENDING_STEP_KEY = 'operari:pendingHttpStep';
const STALE_AFTER_MS = 30 * 60 * 1000; // 30 minutes

interface PendingHttpStep {
  type: 'operari.httpRequest';
  config: {
    method: string;
    url: string;
    headers?: Record<string, string>;
    body?: string;
  };
  createdAt: number;
}

interface Props {
  lang: 'en' | 'es';
  onImport: (config: PendingHttpStep['config']) => void;
}

/**
 * Watches `operari:pendingHttpStep` in localStorage and surfaces a
 * one-click "Import as step" banner when the user has stashed a
 * request from the HTTP tester. Dismissing or accepting clears the
 * key. Stale stashes (>30min old) are auto-cleared so the banner
 * does not haunt the editor across sessions.
 */
export default function PendingHttpStepBanner({ lang, onImport }: Props) {
  const [pending, setPending] = useState<PendingHttpStep | null>(null);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(PENDING_STEP_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw) as PendingHttpStep;
      if (!parsed?.config?.url) {
        window.localStorage.removeItem(PENDING_STEP_KEY);
        return;
      }
      if (Date.now() - parsed.createdAt > STALE_AFTER_MS) {
        window.localStorage.removeItem(PENDING_STEP_KEY);
        return;
      }
      setPending(parsed);
    } catch {
      window.localStorage.removeItem(PENDING_STEP_KEY);
    }
  }, []);

  if (!pending) return null;

  const t =
    lang === 'es'
      ? {
          headline: 'Solicitud HTTP lista para importar',
          import: 'Insertar como step',
          dismiss: 'Descartar',
        }
      : {
          headline: 'HTTP request ready to import',
          import: 'Insert as step',
          dismiss: 'Dismiss',
        };

  const handleImport = () => {
    onImport(pending.config);
    window.localStorage.removeItem(PENDING_STEP_KEY);
    setPending(null);
  };

  const handleDismiss = () => {
    window.localStorage.removeItem(PENDING_STEP_KEY);
    setPending(null);
  };

  return (
    <div className="pointer-events-auto absolute left-1/2 top-3 z-30 flex max-w-[92vw] -translate-x-1/2 items-center gap-2 rounded-md border border-emerald-500/40 bg-zinc-900/95 px-3 py-2 shadow-lg shadow-black/40 backdrop-blur">
      <ArrowRightToLine size={14} className="shrink-0 text-emerald-300" />
      <div className="min-w-0">
        <div className="text-[11px] font-semibold text-zinc-100">{t.headline}</div>
        <div className="truncate font-mono text-[10px] text-zinc-400">
          {pending.config.method} {pending.config.url}
        </div>
      </div>
      <button
        type="button"
        onClick={handleImport}
        className="ml-1 shrink-0 rounded bg-emerald-600 px-2 py-1 text-[11px] font-medium text-white transition-colors hover:bg-emerald-500"
      >
        {t.import}
      </button>
      <button
        type="button"
        onClick={handleDismiss}
        className="shrink-0 p-1 text-zinc-500 transition-colors hover:text-zinc-200"
        aria-label={t.dismiss}
        title={t.dismiss}
      >
        <X size={13} />
      </button>
    </div>
  );
}
