'use client';

import { ArrowDownToLine, Check, X } from 'lucide-react';
import { useEffect, useState } from 'react';

import type { RfNode } from '@/lib/canvas/adapter';
import { useEditorStore } from '@/state/editorStore';

/**
 * Pending-step banner — closes the loop on the SQL editor and
 * HTTP tester's "Save as runbook step" handoff.
 *
 * The handoff:
 *   1. SQL editor / HTTP tester writes a step descriptor to
 *      localStorage under `operari:pendingDbStep` /
 *      `operari:pendingHttpStep`.
 *   2. Operator navigates to /editor (same tab, new tab, doesn't
 *      matter — localStorage carries across).
 *   3. This banner mounts inside the editor canvas, polls the
 *      two keys on mount, and surfaces "Import this query as a
 *      step" if either is set.
 *   4. Accept → build an RfNode with the captured config, call
 *      addNode(), clear the localStorage key. Dismiss → just
 *      clear the key.
 *
 * Why a banner and not auto-insert: a user might land on /editor
 * with an unrelated runbook open. Auto-inserting a query into
 * the wrong runbook is a real "wait what" moment. The banner
 * gives them a beat to confirm.
 *
 * Why two keys instead of a queue: the SQL and HTTP testers are
 * orthogonal flows; the user typically has one or the other
 * pending, rarely both. If both are set, we show whichever was
 * stashed most recently (createdAt) — the older one waits and
 * surfaces after the first is dismissed.
 */

const HTTP_KEY = 'operari:pendingHttpStep';
const DB_KEY = 'operari:pendingDbStep';

interface PendingHttp {
  type: 'operari.httpRequest';
  config: {
    method: string;
    url: string;
    headers?: Record<string, string>;
    body?: string;
  };
  createdAt: number;
}

interface PendingDb {
  type: 'operari.database';
  config: {
    credentialId: string;
    query: string;
  };
  createdAt: number;
}

type Pending =
  | { kind: 'http'; storageKey: typeof HTTP_KEY; payload: PendingHttp }
  | { kind: 'db'; storageKey: typeof DB_KEY; payload: PendingDb };

function readPending(): Pending | null {
  if (typeof window === 'undefined') return null;
  const candidates: Pending[] = [];
  try {
    const raw = window.localStorage.getItem(HTTP_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as PendingHttp;
      if (parsed.type === 'operari.httpRequest' && typeof parsed.config?.url === 'string') {
        candidates.push({ kind: 'http', storageKey: HTTP_KEY, payload: parsed });
      }
    }
  } catch {
    // bad JSON — drop the key so we don't keep tripping on it
    window.localStorage.removeItem(HTTP_KEY);
  }
  try {
    const raw = window.localStorage.getItem(DB_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as PendingDb;
      if (parsed.type === 'operari.database' && typeof parsed.config?.query === 'string') {
        candidates.push({ kind: 'db', storageKey: DB_KEY, payload: parsed });
      }
    }
  } catch {
    window.localStorage.removeItem(DB_KEY);
  }
  if (candidates.length === 0) return null;
  // Prefer the most recently stashed one. The other waits.
  candidates.sort((a, b) => b.payload.createdAt - a.payload.createdAt);
  return candidates[0];
}

export default function PendingStepBanner({ lang }: { lang: 'en' | 'es' }) {
  const addNode = useEditorStore(s => s.addNode);
  const [pending, setPending] = useState<Pending | null>(null);
  const [imported, setImported] = useState(false);

  useEffect(() => {
    setPending(readPending());
  }, []);

  if (!pending || imported) return null;

  const t =
    lang === 'es'
      ? {
          httpTitle: 'Importar petición HTTP como step',
          httpHint: 'La armaste en el Probador API. La pasamos al runbook actual.',
          dbTitle: 'Importar query SQL como step',
          dbHint: 'La armaste en el SQL Editor. La pasamos al runbook actual.',
          accept: 'Importar',
          dismiss: 'Descartar',
          imported: 'Step añadido',
        }
      : {
          httpTitle: 'Import HTTP request as a step',
          httpHint: 'You built it in the API Tester. We can drop it in the active runbook.',
          dbTitle: 'Import SQL query as a step',
          dbHint: 'You built it in the SQL Editor. We can drop it in the active runbook.',
          accept: 'Import',
          dismiss: 'Dismiss',
          imported: 'Step added',
        };

  const title = pending.kind === 'http' ? t.httpTitle : t.dbTitle;
  const hint = pending.kind === 'http' ? t.httpHint : t.dbHint;
  const previewLine =
    pending.kind === 'http'
      ? `${pending.payload.config.method} ${pending.payload.config.url}`
      : pending.payload.config.query.split('\n')[0].slice(0, 96);

  const handleAccept = () => {
    const id =
      typeof crypto !== 'undefined' && 'randomUUID' in crypto
        ? crypto.randomUUID()
        : `node-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    // Drop the new node into a region where the operator is
    // likely already looking. (200, 200) lands in the upper-left
    // of an empty canvas; for a populated canvas the user can
    // immediately drag it. No screenToFlowPosition because we
    // don't have an event coordinate to anchor against.
    const newNode: RfNode = {
      id,
      type: pending.payload.type,
      position: { x: 200, y: 200 },
      data: {
        workflow: {
          title:
            pending.kind === 'http'
              ? `${pending.payload.config.method} ${new URL(pending.payload.config.url, 'http://placeholder').pathname}`
              : 'Database query',
          enabled: true,
          config: pending.payload.config as unknown as Record<string, unknown>,
        },
      },
    };
    addNode(newNode);
    window.localStorage.removeItem(pending.storageKey);
    setImported(true);
    // Auto-fade after the confirmation flash.
    window.setTimeout(() => {
      setPending(null);
      setImported(false);
    }, 1500);
  };

  const handleDismiss = () => {
    window.localStorage.removeItem(pending.storageKey);
    setPending(null);
  };

  return (
    <div className="pointer-events-auto absolute left-1/2 top-4 z-50 -translate-x-1/2">
      <div className="flex items-center gap-3 rounded-lg border border-emerald-700/50 bg-zinc-950/95 px-4 py-2.5 shadow-2xl backdrop-blur">
        <ArrowDownToLine size={14} className="shrink-0 text-emerald-400" />
        <div className="min-w-0">
          <div className="text-[12px] font-semibold text-white">{title}</div>
          <div className="mt-0.5 truncate font-mono text-[10.5px] text-zinc-500">{previewLine}</div>
          <div className="text-[10.5px] italic text-zinc-500">{hint}</div>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          {imported ? (
            <span className="inline-flex items-center gap-1 rounded border border-emerald-700/50 bg-emerald-950/40 px-2 py-1 text-[10.5px] font-medium text-emerald-200">
              <Check size={11} />
              {t.imported}
            </span>
          ) : (
            <>
              <button
                onClick={handleAccept}
                className="rounded border border-emerald-700 bg-emerald-900/40 px-2.5 py-1 text-[11px] font-medium text-emerald-200 transition-colors hover:bg-emerald-900/60"
              >
                {t.accept}
              </button>
              <button
                onClick={handleDismiss}
                className="rounded border border-zinc-700 px-1.5 py-1 text-zinc-400 transition-colors hover:border-red-800 hover:text-red-300"
                aria-label={t.dismiss}
                title={t.dismiss}
              >
                <X size={11} />
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
