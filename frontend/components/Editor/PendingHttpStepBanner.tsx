'use client';

import { ArrowRightToLine, X } from 'lucide-react';
import { useEffect, useState } from 'react';

const PENDING_HTTP_KEY = 'operari:pendingHttpStep';
const PENDING_MCP_KEY = 'operari:pendingMcpStep';
const STALE_AFTER_MS = 30 * 60 * 1000; // 30 minutes

export type PendingStep =
  | {
      type: 'operari.httpRequest';
      config: {
        method: string;
        url: string;
        headers?: Record<string, string>;
        body?: string;
      };
      createdAt: number;
    }
  | {
      type: 'mcp.callTool';
      config: {
        credential?: string;
        url?: string;
        tool: string;
        arguments: string;
        toolHash: string;
      };
      /** Shown in the banner; the credential id alone says nothing. */
      server: string;
      createdAt: number;
    };

interface Props {
  lang: 'en' | 'es';
  onImport: (step: PendingStep) => void;
}

function isUsable(step: PendingStep | null): step is PendingStep {
  if (!step?.config) return false;
  return step.type === 'mcp.callTool' ? Boolean(step.config.tool) : Boolean(step.config.url);
}

/**
 * Watches the HTTP and MCP testers' localStorage handoff keys and
 * surfaces a one-click "Import as step" banner when the user has
 * stashed a request. Dismissing or accepting clears the key. Stale
 * stashes (>30min old) are auto-cleared so the banner does not haunt
 * the editor across sessions.
 */
export default function PendingHttpStepBanner({ lang, onImport }: Props) {
  const [pending, setPending] = useState<{ key: string; step: PendingStep } | null>(null);

  useEffect(() => {
    for (const key of [PENDING_HTTP_KEY, PENDING_MCP_KEY]) {
      try {
        const raw = window.localStorage.getItem(key);
        if (!raw) continue;
        const parsed = JSON.parse(raw) as PendingStep;
        if (!isUsable(parsed) || Date.now() - parsed.createdAt > STALE_AFTER_MS) {
          window.localStorage.removeItem(key);
          continue;
        }
        setPending({ key, step: parsed });
        return;
      } catch {
        window.localStorage.removeItem(key);
      }
    }
  }, []);

  if (!pending) return null;
  const { key, step } = pending;
  const isMcp = step.type === 'mcp.callTool';

  const t =
    lang === 'es'
      ? {
          headline: isMcp
            ? 'Herramienta MCP lista para importar'
            : 'Solicitud HTTP lista para importar',
          import: 'Insertar como step',
          dismiss: 'Descartar',
        }
      : {
          headline: isMcp ? 'MCP tool ready to import' : 'HTTP request ready to import',
          import: 'Insert as step',
          dismiss: 'Dismiss',
        };

  const handleImport = () => {
    onImport(step);
    window.localStorage.removeItem(key);
    setPending(null);
  };

  const handleDismiss = () => {
    window.localStorage.removeItem(key);
    setPending(null);
  };

  return (
    <div className="pointer-events-auto absolute left-1/2 top-3 z-30 flex max-w-[92vw] -translate-x-1/2 items-center gap-2 rounded-md border border-emerald-500/40 bg-zinc-900/95 px-3 py-2 shadow-lg shadow-black/40 backdrop-blur">
      <ArrowRightToLine size={14} className="shrink-0 text-emerald-300" />
      <div className="min-w-0">
        <div className="text-[11px] font-semibold text-zinc-100">{t.headline}</div>
        <div className="truncate font-mono text-[10px] text-zinc-400">
          {step.type === 'mcp.callTool'
            ? `${step.config.tool} · ${step.server}`
            : `${step.config.method} ${step.config.url}`}
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

export { PENDING_HTTP_KEY, PENDING_MCP_KEY };
