'use client';

import { Trash2 } from 'lucide-react';

import type { RequestPayload } from './RequestForm';

export interface HistoryEntry {
  id: string;
  method: string;
  url: string;
  status: number;
  durationMs: number;
  timestamp: number;
  payload: RequestPayload;
}

interface Props {
  entries: HistoryEntry[];
  onLoad: (entry: HistoryEntry) => void;
  onClear: () => void;
  lang: 'en' | 'es';
}

const METHOD_TINT: Record<string, string> = {
  GET: 'text-emerald-400',
  POST: 'text-amber-400',
  PUT: 'text-blue-400',
  PATCH: 'text-sky-400',
  DELETE: 'text-rose-400',
  HEAD: 'text-zinc-400',
};

function statusTone(status: number): string {
  if (status >= 500) return 'text-rose-400';
  if (status >= 400) return 'text-amber-400';
  if (status >= 300) return 'text-sky-400';
  if (status >= 200) return 'text-emerald-400';
  return 'text-zinc-500';
}

function relativeTime(ts: number, lang: 'en' | 'es'): string {
  const diff = Date.now() - ts;
  const sec = Math.round(diff / 1000);
  if (sec < 60) return lang === 'es' ? `hace ${sec}s` : `${sec}s ago`;
  const min = Math.round(sec / 60);
  if (min < 60) return lang === 'es' ? `hace ${min}m` : `${min}m ago`;
  const hr = Math.round(min / 60);
  if (hr < 24) return lang === 'es' ? `hace ${hr}h` : `${hr}h ago`;
  const day = Math.round(hr / 24);
  return lang === 'es' ? `hace ${day}d` : `${day}d ago`;
}

export default function HistorySidebar({ entries, onLoad, onClear, lang }: Props) {
  const t =
    lang === 'es'
      ? { empty: 'Sin solicitudes recientes', clear: 'Vaciar' }
      : { empty: 'No recent requests', clear: 'Clear' };

  if (entries.length === 0) {
    return (
      <div className="flex flex-1 items-center justify-center p-4 text-center text-xs text-zinc-600">
        {t.empty}
      </div>
    );
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex-1 overflow-auto">
        {entries.map(entry => (
          <button
            key={entry.id}
            type="button"
            onClick={() => onLoad(entry)}
            className="flex w-full flex-col gap-0.5 border-b border-zinc-800/50 px-3 py-2 text-left transition-colors hover:bg-zinc-800/40"
          >
            <div className="flex items-center gap-2">
              <span
                className={`font-mono text-[10px] font-bold ${METHOD_TINT[entry.method] ?? 'text-zinc-400'}`}
              >
                {entry.method}
              </span>
              <span className={`font-mono text-[10px] ${statusTone(entry.status)}`}>
                {entry.status}
              </span>
              <span className="ml-auto text-[10px] text-zinc-600">
                {relativeTime(entry.timestamp, lang)}
              </span>
            </div>
            <div className="truncate font-mono text-[11px] text-zinc-300">{entry.url}</div>
            <div className="text-[10px] text-zinc-600">{entry.durationMs}ms</div>
          </button>
        ))}
      </div>
      <button
        type="button"
        onClick={onClear}
        className="flex items-center justify-center gap-1.5 border-t border-zinc-800 px-3 py-2 text-[11px] text-zinc-500 transition-colors hover:bg-zinc-800/40 hover:text-rose-300"
      >
        <Trash2 size={11} />
        {t.clear}
      </button>
    </div>
  );
}
