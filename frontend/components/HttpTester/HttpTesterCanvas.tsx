'use client';

import { HelpCircle, History, PanelLeft, Send, X, Zap } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useHotkeys } from 'react-hotkeys-hook';
import { Group, Panel, Separator } from 'react-resizable-panels';
import { toast } from 'sonner';

import { chipButton } from '@/components/ui/buttonVariants';
import { useApiPrefs } from '@/lib/userPrefs';

import ConvertToStepButton from './ConvertToStepButton';
import HistorySidebar, { type HistoryEntry } from './HistorySidebar';
import { detectActiveMethod, HttpHelpDrawer } from './HttpHelpDrawer';
import RequestForm, { type RequestPayload } from './RequestForm';
import ResponseViewer, { type ResponseError, type ResponseResult } from './ResponseViewer';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';
const HISTORY_KEY = 'operari:httpTesterHistory';

export default function HttpTesterCanvas({ lang }: { lang: 'en' | 'es' }) {
  const [apiPrefs] = useApiPrefs();

  // Default payload reflects the user's preferred method + headers
  // from /settings → API tester. Memoized so the form initial state
  // doesn't snap on every prefs refresh.
  const defaultPayload = useMemo<RequestPayload>(
    () => ({
      method: apiPrefs.defaultMethod,
      url: '',
      headers: [{ key: 'Accept', value: apiPrefs.defaultAcceptHeader }],
      body: '',
    }),
    [apiPrefs.defaultMethod, apiPrefs.defaultAcceptHeader]
  );

  const [payload, setPayload] = useState<RequestPayload>(defaultPayload);
  const [result, setResult] = useState<ResponseResult | null>(null);

  // Reverse handoff from the runbook editor — when an operator
  // clicked "Open in API Tester" on an `operari.httpRequest` step,
  // the editor stashed method/url/headers/body under
  // `operari:prefillHttpTester`. Read on mount, prefill, clear.
  // Headers come in as a flat record on the wire (matching the
  // step config shape) and need re-mapping into the {key,value}[]
  // shape RequestForm expects.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const raw = window.localStorage.getItem('operari:prefillHttpTester');
    if (!raw) return;
    try {
      const parsed = JSON.parse(raw) as {
        method?: string;
        url?: string;
        headers?: Record<string, string>;
        body?: string;
      };
      const headerEntries: Array<{ key: string; value: string }> =
        parsed.headers && typeof parsed.headers === 'object'
          ? Object.entries(parsed.headers).map(([key, value]) => ({ key, value }))
          : [];
      const validMethods = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD'] as const;
      const methodFromHandoff = (validMethods as readonly string[]).includes(parsed.method ?? '')
        ? (parsed.method as RequestPayload['method'])
        : null;
      setPayload(prev => ({
        method: methodFromHandoff ?? prev.method,
        url: typeof parsed.url === 'string' ? parsed.url : prev.url,
        headers: headerEntries.length > 0 ? headerEntries : prev.headers,
        body: typeof parsed.body === 'string' ? parsed.body : prev.body,
      }));
    } catch {
      // bad JSON — drop it so a refresh doesn't keep retrying
    }
    window.localStorage.removeItem('operari:prefillHttpTester');
  }, []);
  const [error, setError] = useState<ResponseError | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [historyOpenMobile, setHistoryOpenMobile] = useState(false);
  // Cheatsheet drawer — slide-in panel mirroring the SQL editor's
  // help affordance. Toggled via the toolbar button and the `?` key.
  const [helpOpen, setHelpOpen] = useState(false);
  const HISTORY_CAP = apiPrefs.historyCap;

  // `?` toggles the help drawer (GitHub-style). react-hotkeys-hook
  // skips form tags by default so the operator can still type a
  // literal `?` inside an input.
  useHotkeys('shift+/', () => setHelpOpen(o => !o), { preventDefault: true });

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

    // Apply user prefs from /settings → API tester:
    //  - timeout aborts the proxied call after the configured budget
    //  - cookies / redirects / self-signed flags travel as request
    //    options so the backend respects them when it makes the
    //    upstream call (server-side fetch can't read them from the
    //    browser tab).
    const controller = new AbortController();
    const timeoutId = window.setTimeout(() => controller.abort(), apiPrefs.defaultTimeoutMs);

    try {
      const res = await fetch(`${API_BASE}/api/http-tester/execute`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        signal: controller.signal,
        body: JSON.stringify({
          method: payload.method,
          url: payload.url.trim(),
          headers: Object.keys(headersObj).length > 0 ? headersObj : undefined,
          body: payload.body || undefined,
          timeoutMs: apiPrefs.defaultTimeoutMs,
          followRedirects: apiPrefs.followRedirects,
          preserveCookies: apiPrefs.preserveCookies,
          allowSelfSignedCerts: apiPrefs.allowSelfSignedCerts,
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
        // Toast on 4xx/5xx responses too — the request succeeded but
        // the upstream returned an error status, which the operator
        // still wants to know about even if their eye is on the
        // request pane.
        if (success.status >= 400) {
          toast.error(`HTTP ${success.status} · ${success.statusText || 'error'}`);
        }
      } else {
        const err: ResponseError = {
          status: res.status,
          message: data.message || data.error || 'Request failed',
          reason: data.reason,
        };
        setError(err);
        toast.error(err.reason ? `Blocked: ${err.message}` : err.message);
      }
    } catch (err) {
      const failure: ResponseError = {
        status: 0,
        message:
          err instanceof Error && err.name === 'AbortError'
            ? `Request timed out after ${apiPrefs.defaultTimeoutMs}ms`
            : err instanceof Error
              ? err.message
              : 'Network error',
      };
      setError(failure);
      toast.error(failure.message);
    } finally {
      window.clearTimeout(timeoutId);
      setIsLoading(false);
    }
  }, [payload, history, persistHistory, apiPrefs, HISTORY_CAP]);

  const loadFromHistory = useCallback((entry: HistoryEntry) => {
    setPayload(entry.payload);
    setHistoryOpenMobile(false);
  }, []);

  const clearHistory = useCallback(() => {
    persistHistory([]);
  }, [persistHistory]);

  // Ctrl/Cmd+Enter to send — same chord as the SQL editor for muscle
  // memory. enableOnFormTags lets the chord fire even when a header
  // input is focused, which is exactly what the operator wants here
  // (chord submits the form, no need to blur first).
  useHotkeys(['ctrl+enter', 'meta+enter'], () => sendRequest(), {
    enableOnFormTags: true,
    preventDefault: true,
  });

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

          {/* Help drawer toggle — slide-in cheatsheet covering HTTP
              methods, status codes, auth patterns, and body shapes.
              Keyboard: `?`. */}
          <button
            type="button"
            onClick={() => setHelpOpen(o => !o)}
            className={chipButton({ tone: helpOpen ? 'primary' : 'neutral' })}
            title={lang === 'es' ? 'Ayuda API  (?)' : 'API help  (?)'}
            aria-label={lang === 'es' ? 'Abrir ayuda API' : 'Open API help'}
          >
            <HelpCircle size={11} />
            <span className="hidden sm:inline">{lang === 'es' ? 'Ayuda' : 'Help'}</span>
            <kbd className="hidden rounded bg-zinc-800 px-1 font-mono text-[9px] text-zinc-400 sm:inline">
              ?
            </kbd>
          </button>

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

        <Group
          orientation="vertical"
          id="operari-http-tester-request-response"
          className="flex min-h-0 flex-1 flex-col"
        >
          <Panel defaultSize={45} minSize={20} className="flex flex-col border-b border-zinc-800">
            <div className="flex items-center justify-between border-b border-zinc-800/50 px-3 py-1.5">
              <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-600">
                {t.request}
              </span>
              <span className="hidden text-[10px] text-zinc-700 sm:inline">{t.tip}</span>
            </div>
            <div className="flex-1 overflow-auto p-3">
              <RequestForm payload={payload} onChange={setPayload} lang={lang} />
            </div>
          </Panel>

          <Separator className="group h-1 cursor-row-resize bg-zinc-800/50 transition-colors hover:bg-emerald-700/40 data-[dragging]:bg-emerald-600" />

          <Panel defaultSize={55} minSize={15} className="flex min-h-0 flex-col overflow-hidden">
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
          </Panel>
        </Group>
      </div>
      <HttpHelpDrawer
        open={helpOpen}
        onClose={() => setHelpOpen(false)}
        lang={lang}
        // Auto-jump to the methods topic when the operator has a
        // recognised method selected. Status / auth topics aren't
        // tied to the form state so they stay reachable via the
        // top nav chips.
        initialTopicId={detectActiveMethod(payload.method)}
        onInsertSnippet={snippet => {
          // Snippets like `Authorization: Bearer {{secrets...}}` are
          // headers. Append a new header row by parsing `Key: Value`
          // shapes; everything else lands in the body so the operator
          // sees the snippet land somewhere meaningful instead of
          // silently doing nothing.
          const trimmed = snippet.trim();
          const headerMatch = trimmed.match(/^([A-Za-z][A-Za-z0-9-]*)\s*:\s*(.+)$/m);
          if (headerMatch && !trimmed.includes('\n\n') && !trimmed.startsWith('{')) {
            // Multi-line header sets (e.g. the auth examples) parse
            // each line as its own header.
            const headers = trimmed
              .split(/\r?\n/)
              .map(line => line.match(/^([A-Za-z][A-Za-z0-9-]*)\s*:\s*(.+)$/))
              .filter((m): m is RegExpMatchArray => !!m)
              .map(m => ({ key: m[1].trim(), value: m[2].trim() }));
            if (headers.length > 0) {
              setPayload(prev => ({ ...prev, headers: [...prev.headers, ...headers] }));
              setHelpOpen(false);
              return;
            }
          }
          setPayload(prev => ({
            ...prev,
            body: prev.body ? `${prev.body}\n\n${snippet}` : snippet,
          }));
          setHelpOpen(false);
        }}
      />
    </div>
  );
}
