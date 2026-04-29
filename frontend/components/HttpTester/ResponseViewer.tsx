'use client';

import { AlertTriangle } from 'lucide-react';
import { useMemo, useState } from 'react';

export interface ResponseResult {
  status: number;
  statusText: string;
  headers: Record<string, string>;
  body: string;
  url: string;
  method: string;
  durationMs: number;
}

export interface ResponseError {
  status: number;
  message: string;
  reason?: string;
}

interface Props {
  result: ResponseResult | null;
  error: ResponseError | null;
  lang: 'en' | 'es';
}

type Tab = 'body' | 'headers' | 'raw';

function statusTint(status: number): string {
  if (status >= 500) return 'bg-rose-500/20 text-rose-300 border-rose-500/40';
  if (status >= 400) return 'bg-amber-500/20 text-amber-300 border-amber-500/40';
  if (status >= 300) return 'bg-sky-500/20 text-sky-300 border-sky-500/40';
  if (status >= 200) return 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40';
  return 'bg-zinc-500/20 text-zinc-300 border-zinc-500/40';
}

function tryPrettyJson(raw: string): string | null {
  if (!raw) return null;
  const trimmed = raw.trim();
  if (!trimmed.startsWith('{') && !trimmed.startsWith('[')) return null;
  try {
    return JSON.stringify(JSON.parse(trimmed), null, 2);
  } catch {
    return null;
  }
}

export default function ResponseViewer({ result, error, lang }: Props) {
  const [tab, setTab] = useState<Tab>('body');

  const t =
    lang === 'es'
      ? {
          body: 'Body',
          headers: 'Headers',
          raw: 'Raw',
          empty: 'Sin contenido',
          requestBlocked: 'Solicitud bloqueada',
          requestFailed: 'Solicitud fallida',
        }
      : {
          body: 'Body',
          headers: 'Headers',
          raw: 'Raw',
          empty: 'Empty body',
          requestBlocked: 'Request blocked',
          requestFailed: 'Request failed',
        };

  const pretty = useMemo(() => (result ? tryPrettyJson(result.body) : null), [result]);

  if (error) {
    return (
      <div className="p-4">
        <div className="flex items-start gap-2 rounded border border-rose-500/40 bg-rose-500/10 p-3">
          <AlertTriangle size={16} className="mt-0.5 shrink-0 text-rose-300" />
          <div className="min-w-0 flex-1">
            <div className="text-xs font-semibold text-rose-200">
              {error.reason ? t.requestBlocked : t.requestFailed}
              {error.status > 0 && (
                <span className="ml-2 font-mono text-[11px] text-rose-300/70">
                  HTTP {error.status}
                </span>
              )}
            </div>
            <div className="mt-1 break-words text-xs text-rose-100/80">{error.message}</div>
            {error.reason && (
              <div className="mt-1 font-mono text-[11px] text-rose-300/60">
                reason: {error.reason}
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  if (!result) return null;

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-2 border-b border-zinc-800/50 px-3 py-2">
        <span
          className={`rounded border px-1.5 py-0.5 font-mono text-[11px] font-bold ${statusTint(result.status)}`}
        >
          {result.status} {result.statusText}
        </span>
        <span className="truncate text-[11px] text-zinc-500">
          {result.method} {result.url}
        </span>
      </div>

      <div className="flex border-b border-zinc-800/50">
        <ResTab active={tab === 'body'} onClick={() => setTab('body')}>
          {t.body}
        </ResTab>
        <ResTab active={tab === 'headers'} onClick={() => setTab('headers')}>
          {t.headers}
          <span className="ml-1.5 rounded bg-zinc-800 px-1 text-[9px] text-zinc-400">
            {Object.keys(result.headers).length}
          </span>
        </ResTab>
        <ResTab active={tab === 'raw'} onClick={() => setTab('raw')}>
          {t.raw}
        </ResTab>
      </div>

      <div className="min-h-0 flex-1 overflow-auto">
        {tab === 'body' && (
          <pre className="whitespace-pre-wrap break-words p-3 font-mono text-[11px] text-zinc-200">
            {result.body ? (
              (pretty ?? result.body)
            ) : (
              <span className="text-zinc-600">{t.empty}</span>
            )}
          </pre>
        )}
        {tab === 'headers' && (
          <div className="divide-y divide-zinc-800/50 font-mono text-[11px]">
            {Object.entries(result.headers).map(([key, value]) => (
              <div key={key} className="grid grid-cols-[160px_1fr] gap-3 px-3 py-1.5">
                <span className="truncate text-zinc-500">{key}</span>
                <span className="break-all text-zinc-200">{value}</span>
              </div>
            ))}
          </div>
        )}
        {tab === 'raw' && (
          <pre className="whitespace-pre-wrap break-words p-3 font-mono text-[11px] text-zinc-300">
            {result.body || <span className="text-zinc-600">{t.empty}</span>}
          </pre>
        )}
      </div>
    </div>
  );
}

function ResTab({
  children,
  active,
  onClick,
}: {
  children: React.ReactNode;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`-mb-px border-b-2 px-3 py-1.5 text-[11px] font-medium uppercase tracking-wider transition-colors ${
        active
          ? 'border-emerald-500 text-emerald-300'
          : 'border-transparent text-zinc-500 hover:text-zinc-300'
      }`}
    >
      {children}
    </button>
  );
}
