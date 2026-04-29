'use client';

import { History, PanelLeft, Send, X, Zap } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';

import ConvertToStepButton from './ConvertToStepButton';
import HistorySidebar, { type HistoryEntry } from './HistorySidebar';
import RequestForm, { type RequestPayload } from './RequestForm';
import ResponseViewer, { type ResponseError, type ResponseResult } from './ResponseViewer';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';
const HISTORY_KEY = 'operari:httpTesterHistory';
const HISTORY_CAP = 50;

const DEFAULT_PAYLOAD: RequestPayload = {
  method: 'GET',
  url: '',
  headers: [],
  body: '',
};

export default function HttpTesterCanvas({ lang }: { lang: 'en' | 'es' }) {
  const [payload, setPayload] = useState<RequestPayload>(DEFAULT_PAYLOAD);
  const [result, setResult] = useState<ResponseResult | null>(null);
  const [error, setError] = useState<ResponseError | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [historyOpenMobile, setHistoryOpenMobile] = useState(false);

  const t =
    lang === 'es'
      ? {
          title: 'Probador de API',
          send: 'Enviar',
          sendHint: 'Ctrl+Enter',
          history: 'Historial',
          response: 'Respuesta',
          request: 'Solicitud',
          empty: 'Mandá una solicitud para ver la respuesta',
          openHistory: 'Abrir historial',
          closeHistory: 'Cerrar historial',
          tip: 'Consejo: usá {{secrets.<id>}} en headers para inyectar tokens del vault',
        }
      : {
          title: 'API Tester',
          send: 'Send',
          sendHint: 'Ctrl+Enter',
          history: 'History',
          response: 'Response',
          request: 'Request',
          empty: 'Send a request to see the response',
          openHistory: 'Open history',
          closeHistory: 'Close history',
          tip: 'Tip: use {{secrets.<id>}} in headers to inject vault tokens',
        };

  // Load history once on mount.
  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(HISTORY_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) setHistory(parsed.slice(0, HISTORY_CAP));
      }
    } catch {
      /* corrupt history → start fresh */
    }
  }, []);

  const persistHistory = useCallback((next: HistoryEntry[]) => {
    setHistory(next);
    try {
      window.localStorage.setItem(HISTORY_KEY, JSON.stringify(next.slice(0, HISTORY_CAP)));
    } catch {
      /* localStorage might be full / disabled — non-fatal */
    }
  }, []);

  const sendRequest = useCallback(async () => {
    if (!payload.url.trim()) return;
    setIsLoading(true);
    setError(null);
    setResult(null);

    const headersObj: Record<string, string> = {};
    for (const { key, value } of payload.headers) {
      const k = key.trim();
      if (k) headersObj[k] = value;
    }

    try {
      const res = await fetch(`${API_BASE}/api/http-tester/execute`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          method: payload.method,
          url: payload.url.trim(),
          headers: Object.keys(headersObj).length > 0 ? headersObj : undefined,
          body: payload.body || undefined,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        const success: ResponseResult = data;
        setResult(success);
        const entry: HistoryEntry = {
          id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
          method: payload.method,
          url: payload.url.trim(),
          status: success.status,
          durationMs: success.durationMs,
          timestamp: Date.now(),
          payload,
        };
        persistHistory([entry, ...history].slice(0, HISTORY_CAP));
      } else {
        setError({
          status: res.status,
          message: data.message || data.error || 'Request failed',
          reason: data.reason,
        });
      }
    } catch (err) {
      setError({
        status: 0,
        message: err instanceof Error ? err.message : 'Network error',
      });
    } finally {
      setIsLoading(false);
    }
  }, [payload, history, persistHistory]);

  const loadFromHistory = useCallback((entry: HistoryEntry) => {
    setPayload(entry.payload);
    setHistoryOpenMobile(false);
  }, []);

  const clearHistory = useCallback(() => {
    persistHistory([]);
  }, [persistHistory]);

  // Ctrl/Cmd+Enter to send — same chord as the SQL editor for muscle memory.
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
        e.preventDefault();
        sendRequest();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [sendRequest]);

  return (
    <div className="flex h-screen w-full bg-zinc-950 text-zinc-200">
      {historyOpenMobile && (
        <button
          type="button"
          aria-label={t.closeHistory}
          onClick={() => setHistoryOpenMobile(false)}
          className="fixed inset-0 z-30 bg-black/50 lg:hidden"
        />
      )}

      <div
        className={`fixed inset-y-0 left-0 z-40 w-72 max-w-[85vw] flex-col border-r border-zinc-800 bg-zinc-950 transition-transform lg:static lg:w-64 lg:max-w-none lg:translate-x-0 ${
          historyOpenMobile ? 'flex translate-x-0' : 'hidden -translate-x-full lg:flex'
        }`}
      >
        <div className="flex items-center justify-between border-b border-zinc-800 bg-zinc-900/50 px-3 py-2.5">
          <span className="text-xs font-semibold uppercase tracking-wide text-zinc-300">
            {t.history}
          </span>
          <button
            onClick={() => setHistoryOpenMobile(false)}
            className="p-1 text-zinc-500 transition-colors hover:text-white lg:hidden"
            aria-label={t.closeHistory}
          >
            <X size={14} />
          </button>
        </div>
        <HistorySidebar
          entries={history}
          onLoad={loadFromHistory}
          onClear={clearHistory}
          lang={lang}
        />
      </div>

      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex h-11 shrink-0 items-center gap-2 border-b border-zinc-800 bg-zinc-900/50 px-3 sm:gap-3 sm:px-4">
          <button
            onClick={() => setHistoryOpenMobile(true)}
            className="p-1 text-zinc-400 transition-colors hover:text-white lg:hidden"
            aria-label={t.openHistory}
          >
            <PanelLeft size={16} />
          </button>
          <Zap size={16} className="text-primary/70 hidden sm:block" />
          <span className="text-sm font-semibold text-white">{t.title}</span>

          <div className="flex-1" />

          <ConvertToStepButton payload={payload} lang={lang} disabled={!payload.url.trim()} />

          <button
            onClick={sendRequest}
            disabled={isLoading || !payload.url.trim()}
            className="flex items-center gap-1.5 rounded bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-emerald-500 disabled:bg-zinc-700 disabled:text-zinc-500"
          >
            <Send size={12} />
            {t.send}
            <span className="ml-1 hidden text-[10px] text-emerald-300/60 sm:inline">
              {t.sendHint}
            </span>
          </button>
        </div>

        <div className="flex min-h-0 flex-1 flex-col">
          <div
            className="flex flex-col border-b border-zinc-800"
            style={{ minHeight: '240px', maxHeight: '55%' }}
          >
            <div className="flex items-center justify-between border-b border-zinc-800/50 px-3 py-1.5">
              <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-600">
                {t.request}
              </span>
              <span className="hidden text-[10px] text-zinc-700 sm:inline">{t.tip}</span>
            </div>
            <div className="flex-1 overflow-auto p-3">
              <RequestForm payload={payload} onChange={setPayload} lang={lang} />
            </div>
          </div>

          <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
            <div className="flex shrink-0 items-center gap-2 border-b border-zinc-800/50 px-3 py-1.5">
              <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-600">
                {t.response}
              </span>
              {result && <span className="text-[10px] text-zinc-600">· {result.durationMs}ms</span>}
            </div>
            <div className="flex-1 overflow-auto">
              {isLoading ? (
                <div className="flex h-full items-center justify-center text-xs text-zinc-500">
                  <History className="mr-2 h-4 w-4 animate-spin" />
                  {lang === 'es' ? 'Enviando…' : 'Sending…'}
                </div>
              ) : !result && !error ? (
                <div className="flex h-full items-center justify-center text-xs text-zinc-600">
                  {t.empty}
                </div>
              ) : (
                <ResponseViewer result={result} error={error} lang={lang} />
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
