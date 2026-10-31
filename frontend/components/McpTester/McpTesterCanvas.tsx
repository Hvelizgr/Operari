'use client';

import {
  ArrowRightToLine,
  Check,
  Loader2,
  Play,
  Plug,
  Search,
  ShieldAlert,
  Wrench,
} from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';

import { PENDING_MCP_KEY, type PendingStep } from '@/components/Editor/PendingHttpStepBanner';
import { csrfToken } from '@/lib/auth';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

interface McpTool {
  name: string;
  title?: string;
  description?: string;
  inputSchema?: { properties?: Record<string, { type?: string; default?: unknown }> };
  annotations?: { readOnlyHint?: boolean; destructiveHint?: boolean };
  hash: string;
}

interface Inspection {
  server: { name: string; version: string } | null;
  instructions: string | null;
  tools: McpTool[];
  resources: Array<{ uri: string; name?: string }>;
  prompts: Array<{ name: string; description?: string }>;
  durationMs: number;
}

interface CallOutcome {
  result: {
    content?: Array<{ type: string; text?: string }>;
    structuredContent?: unknown;
    isError?: boolean;
  };
  durationMs: number;
}

interface Credential {
  id: string;
  displayName?: string | null;
  metadata?: { url?: string };
}

const TEXT = {
  en: {
    title: 'MCP Tester',
    credential: 'Saved server',
    none: 'None — type a URL',
    url: 'Server URL',
    token: 'Bearer token (not saved)',
    connect: 'Connect',
    tools: 'Tools',
    resources: 'Resources',
    prompts: 'Prompts',
    filter: 'Filter tools',
    args: 'Arguments (JSON)',
    call: 'Call tool',
    result: 'Result',
    toolError: 'Tool reported an error',
    toStep: 'To runbook',
    stashed: 'Open the editor to insert it',
    pick: 'Pick a tool to call it',
    empty: 'Connect to an MCP server (Streamable HTTP) to list what it offers.',
    declared: 'declared by the server',
    readOnly: 'read-only',
    destructive: 'destructive',
    untrusted:
      'Descriptions and results come from the server. Read them before pinning a tool into a runbook; every call here is audited.',
    hash: 'Pinned definition',
    invalidJson: 'Arguments must be a JSON object',
    noTokenInStep: 'A typed token is not carried into the step; save the server in Settings.',
  },
  es: {
    title: 'Probador MCP',
    credential: 'Servidor guardado',
    none: 'Ninguno — escribí una URL',
    url: 'URL del servidor',
    token: 'Token Bearer (no se guarda)',
    connect: 'Conectar',
    tools: 'Herramientas',
    resources: 'Recursos',
    prompts: 'Prompts',
    filter: 'Filtrar herramientas',
    args: 'Argumentos (JSON)',
    call: 'Llamar herramienta',
    result: 'Resultado',
    toolError: 'La herramienta devolvió un error',
    toStep: 'A runbook',
    stashed: 'Abrí el editor para insertarlo',
    pick: 'Elegí una herramienta para llamarla',
    empty: 'Conectate a un servidor MCP (Streamable HTTP) para ver qué ofrece.',
    declared: 'según el servidor',
    readOnly: 'solo lectura',
    destructive: 'destructiva',
    untrusted:
      'Las descripciones y los resultados vienen del servidor. Leelos antes de fijar una herramienta en un runbook; cada llamada queda auditada.',
    hash: 'Definición fijada',
    invalidJson: 'Los argumentos tienen que ser un objeto JSON',
    noTokenInStep: 'El token escrito no pasa al paso; guardá el servidor en Settings.',
  },
} as const;

/** `{}` with each property's default, or an empty value of its type, to edit from. */
function skeleton(tool: McpTool): string {
  const props = tool.inputSchema?.properties ?? {};
  const out: Record<string, unknown> = {};
  for (const [key, prop] of Object.entries(props)) {
    out[key] =
      prop.default ??
      ({ number: 0, integer: 0, boolean: false, array: [], object: {} } as Record<string, unknown>)[
        prop.type ?? ''
      ] ??
      '';
  }
  return JSON.stringify(out, null, 2);
}

async function post<T>(path: string, body: unknown): Promise<T> {
  const token = csrfToken();
  const res = await fetch(`${API_BASE}/api/mcp-tester/${path}`, {
    method: 'POST',
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { 'X-CSRF-Token': token } : {}),
    },
    body: JSON.stringify(body),
  });
  const json = (await res.json().catch(() => ({}))) as { data?: T; error?: string };
  if (!res.ok || !json.data) throw new Error(json.error ?? `HTTP ${res.status}`);
  return json.data;
}

export default function McpTesterCanvas({ lang }: { lang: 'en' | 'es' }) {
  const t = TEXT[lang] ?? TEXT.en;
  const [credentials, setCredentials] = useState<Credential[]>([]);
  const [credentialId, setCredentialId] = useState('');
  const [url, setUrl] = useState('');
  const [token, setToken] = useState('');
  const [inspection, setInspection] = useState<Inspection | null>(null);
  const [connecting, setConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<'tools' | 'resources' | 'prompts'>('tools');
  const [filter, setFilter] = useState('');
  const [selected, setSelected] = useState<McpTool | null>(null);
  const [args, setArgs] = useState('{}');
  const [calling, setCalling] = useState(false);
  const [outcome, setOutcome] = useState<CallOutcome | null>(null);
  const [callError, setCallError] = useState<string | null>(null);
  const [stashed, setStashed] = useState(false);

  useEffect(() => {
    fetch(`${API_BASE}/api/connected-accounts?provider=mcp`, { credentials: 'include' })
      .then(res => (res.ok ? res.json() : { data: [] }))
      .then(json => setCredentials((json as { data?: Credential[] }).data ?? []))
      .catch(() => setCredentials([]));
  }, []);

  const target = useMemo(
    () => ({
      ...(credentialId ? { credentialId } : {}),
      ...(url.trim() ? { url: url.trim() } : {}),
      ...(!credentialId && token.trim() ? { token: token.trim() } : {}),
    }),
    [credentialId, url, token]
  );
  const canConnect = Boolean(credentialId || url.trim());

  const connect = useCallback(async () => {
    if (!canConnect) return;
    setConnecting(true);
    setError(null);
    setInspection(null);
    setSelected(null);
    setOutcome(null);
    try {
      setInspection(await post<Inspection>('inspect', target));
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setConnecting(false);
    }
  }, [canConnect, target]);

  const parsedArgs = useMemo(() => {
    try {
      const v = JSON.parse(args || '{}');
      return v && typeof v === 'object' && !Array.isArray(v)
        ? (v as Record<string, unknown>)
        : null;
    } catch {
      return null;
    }
  }, [args]);

  const call = useCallback(async () => {
    if (!selected || !parsedArgs) return;
    setCalling(true);
    setCallError(null);
    setOutcome(null);
    try {
      setOutcome(
        await post<CallOutcome>('call', { ...target, name: selected.name, arguments: parsedArgs })
      );
    } catch (err) {
      setCallError(err instanceof Error ? err.message : String(err));
    } finally {
      setCalling(false);
    }
  }, [selected, parsedArgs, target]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
        e.preventDefault();
        if (selected) void call();
        else void connect();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [call, connect, selected]);

  const pick = (tool: McpTool) => {
    setSelected(tool);
    setArgs(skeleton(tool));
    setOutcome(null);
    setCallError(null);
    setStashed(false);
  };

  const toStep = () => {
    if (!selected || !parsedArgs) return;
    const cred = credentials.find(c => c.id === credentialId);
    const pending: PendingStep = {
      type: 'mcp.callTool',
      config: {
        ...(credentialId ? { credential: `{{secrets.${credentialId}}}` } : {}),
        ...(url.trim() ? { url: url.trim() } : {}),
        tool: selected.name,
        arguments: JSON.stringify(parsedArgs, null, 2),
        toolHash: selected.hash,
      },
      server: inspection?.server?.name ?? cred?.displayName ?? url,
      createdAt: Date.now(),
    };
    try {
      window.localStorage.setItem(PENDING_MCP_KEY, JSON.stringify(pending));
      setStashed(true);
    } catch {
      // Without storage the user can still copy the arguments by hand.
    }
  };

  const tools = (inspection?.tools ?? []).filter(tool =>
    `${tool.name} ${tool.title ?? ''} ${tool.description ?? ''}`
      .toLowerCase()
      .includes(filter.toLowerCase())
  );

  const field =
    'w-full rounded border border-zinc-700 bg-zinc-900 px-2.5 py-1.5 text-xs text-zinc-100 placeholder:text-zinc-600 focus:border-emerald-500/60 focus:outline-none';
  const label = 'mb-1 block text-[10px] font-semibold uppercase tracking-wider text-zinc-500';

  return (
    <div className="flex h-screen min-w-0 flex-1 flex-col bg-zinc-950 text-zinc-200">
      <div className="flex h-11 shrink-0 items-center gap-2 border-b border-zinc-800 bg-zinc-900/50 px-3 sm:px-4">
        <Plug size={16} className="text-primary/70" />
        <span className="text-sm font-semibold text-white">{t.title}</span>
        {inspection?.server && (
          <span className="truncate font-mono text-[11px] text-zinc-500">
            {inspection.server.name} {inspection.server.version} · {inspection.durationMs}ms
          </span>
        )}
      </div>

      <form
        className="grid shrink-0 gap-2 border-b border-zinc-800 p-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)_minmax(0,1fr)_auto] sm:items-end"
        onSubmit={e => {
          e.preventDefault();
          void connect();
        }}
      >
        <div>
          <label className={label} htmlFor="mcp-credential">
            {t.credential}
          </label>
          <select
            id="mcp-credential"
            className={field}
            value={credentialId}
            onChange={e => setCredentialId(e.target.value)}
          >
            <option value="">{t.none}</option>
            {credentials.map(c => (
              <option key={c.id} value={c.id}>
                {c.displayName || c.metadata?.url || c.id}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className={label} htmlFor="mcp-url">
            {t.url}
          </label>
          <input
            id="mcp-url"
            className={`${field} font-mono`}
            value={url}
            onChange={e => setUrl(e.target.value)}
            placeholder={
              credentials.find(c => c.id === credentialId)?.metadata?.url ??
              'https://mcp.example.com/mcp'
            }
          />
        </div>
        <div>
          <label className={label} htmlFor="mcp-token">
            {t.token}
          </label>
          <input
            id="mcp-token"
            type="password"
            autoComplete="off"
            className={`${field} font-mono`}
            value={token}
            onChange={e => setToken(e.target.value)}
            disabled={Boolean(credentialId)}
          />
        </div>
        <button
          type="submit"
          disabled={!canConnect || connecting}
          className="flex h-[30px] items-center justify-center gap-1.5 rounded bg-emerald-600 px-3 text-xs font-medium text-white transition-colors hover:bg-emerald-500 disabled:bg-zinc-700 disabled:text-zinc-500"
        >
          {connecting ? <Loader2 size={12} className="animate-spin" /> : <Plug size={12} />}
          {t.connect}
        </button>
      </form>

      {error && (
        <div
          role="alert"
          className="border-b border-rose-500/30 bg-rose-500/10 px-3 py-2 text-xs text-rose-300"
        >
          {error}
        </div>
      )}

      {!inspection ? (
        <div className="flex flex-1 items-center justify-center p-6 text-center text-xs text-zinc-600">
          {connecting ? <Loader2 className="h-4 w-4 animate-spin" /> : t.empty}
        </div>
      ) : (
        <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
          <aside className="flex max-h-[40vh] min-h-0 flex-col border-b border-zinc-800 lg:max-h-none lg:w-80 lg:border-b-0 lg:border-r">
            <div role="tablist" className="flex shrink-0 border-b border-zinc-800 text-[11px]">
              {(['tools', 'resources', 'prompts'] as const).map(id => (
                <button
                  key={id}
                  role="tab"
                  aria-selected={tab === id}
                  onClick={() => setTab(id)}
                  className={`flex-1 px-2 py-2 transition-colors ${tab === id ? 'border-b-2 border-emerald-500 text-white' : 'text-zinc-500 hover:text-zinc-300'}`}
                >
                  {t[id]} ({inspection[id].length})
                </button>
              ))}
            </div>
            {tab === 'tools' && (
              <>
                <div className="relative shrink-0 p-2">
                  <Search
                    size={12}
                    className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-600"
                  />
                  <input
                    className={`${field} pl-7`}
                    value={filter}
                    onChange={e => setFilter(e.target.value)}
                    placeholder={t.filter}
                    aria-label={t.filter}
                  />
                </div>
                <ul className="min-h-0 flex-1 overflow-auto px-2 pb-2">
                  {tools.map(tool => (
                    <li key={tool.name}>
                      <button
                        onClick={() => pick(tool)}
                        className={`mb-1 w-full rounded px-2 py-1.5 text-left transition-colors ${selected?.name === tool.name ? 'bg-emerald-500/10 text-emerald-200' : 'hover:bg-zinc-800/60'}`}
                      >
                        <div className="truncate font-mono text-xs">{tool.name}</div>
                        {tool.description && (
                          <div className="line-clamp-2 text-[11px] text-zinc-500">
                            {tool.description}
                          </div>
                        )}
                      </button>
                    </li>
                  ))}
                </ul>
              </>
            )}
            {tab === 'resources' && (
              <ul className="min-h-0 flex-1 overflow-auto p-2 font-mono text-[11px]">
                {inspection.resources.map(r => (
                  <li key={r.uri} className="mb-1 truncate text-zinc-400" title={r.uri}>
                    {r.name ? `${r.name} · ` : ''}
                    {r.uri}
                  </li>
                ))}
              </ul>
            )}
            {tab === 'prompts' && (
              <ul className="min-h-0 flex-1 overflow-auto p-2 text-[11px]">
                {inspection.prompts.map(p => (
                  <li key={p.name} className="mb-1.5">
                    <div className="font-mono text-zinc-300">{p.name}</div>
                    {p.description && <div className="text-zinc-500">{p.description}</div>}
                  </li>
                ))}
              </ul>
            )}
          </aside>

          <section className="flex min-h-0 min-w-0 flex-1 flex-col overflow-auto p-3">
            <p className="mb-3 flex items-start gap-1.5 text-[11px] text-amber-300/80">
              <ShieldAlert size={13} className="mt-px shrink-0" />
              {t.untrusted}
            </p>
            {!selected ? (
              <div className="flex flex-1 items-center justify-center text-xs text-zinc-600">
                <Wrench size={14} className="mr-2" />
                {t.pick}
              </div>
            ) : (
              <div className="space-y-3">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="font-mono text-sm text-white">{selected.name}</h2>
                    {selected.annotations?.readOnlyHint && (
                      <span className="rounded border border-sky-500/40 px-1.5 text-[10px] text-sky-300">
                        {t.readOnly} · {t.declared}
                      </span>
                    )}
                    {selected.annotations?.destructiveHint && (
                      <span className="rounded border border-rose-500/40 px-1.5 text-[10px] text-rose-300">
                        {t.destructive} · {t.declared}
                      </span>
                    )}
                  </div>
                  {selected.description && (
                    <p className="mt-1 whitespace-pre-wrap text-xs text-zinc-400">
                      {selected.description}
                    </p>
                  )}
                  <p className="mt-1 font-mono text-[10px] text-zinc-600">
                    {t.hash}: {selected.hash}
                  </p>
                </div>

                <div>
                  <label className={label} htmlFor="mcp-args">
                    {t.args}
                  </label>
                  <textarea
                    id="mcp-args"
                    rows={8}
                    spellCheck={false}
                    className={`${field} font-mono`}
                    value={args}
                    onChange={e => setArgs(e.target.value)}
                    aria-invalid={!parsedArgs}
                  />
                  {!parsedArgs && <p className="mt-1 text-[11px] text-rose-400">{t.invalidJson}</p>}
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <button
                    onClick={() => void call()}
                    disabled={calling || !parsedArgs}
                    className="flex items-center gap-1.5 rounded bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-emerald-500 disabled:bg-zinc-700 disabled:text-zinc-500"
                  >
                    {calling ? <Loader2 size={12} className="animate-spin" /> : <Play size={12} />}
                    {t.call}
                    <span className="ml-1 hidden text-[10px] text-emerald-300/60 sm:inline">
                      Ctrl+Enter
                    </span>
                  </button>
                  <button
                    onClick={toStep}
                    disabled={!parsedArgs}
                    className="flex items-center gap-1.5 rounded border border-zinc-700 px-2.5 py-1.5 text-[11px] text-zinc-300 transition-colors hover:border-emerald-500/60 hover:text-emerald-300 disabled:opacity-40"
                  >
                    {stashed ? (
                      <Check size={11} className="text-emerald-400" />
                    ) : (
                      <ArrowRightToLine size={11} />
                    )}
                    {t.toStep}
                  </button>
                  {stashed && <span className="text-[11px] text-zinc-500">{t.stashed}</span>}
                  {stashed && !credentialId && token && (
                    <span className="text-[11px] text-amber-300/80">{t.noTokenInStep}</span>
                  )}
                </div>

                {callError && (
                  <div
                    role="alert"
                    className="rounded border border-rose-500/30 bg-rose-500/10 p-2 text-xs text-rose-300"
                  >
                    {callError}
                  </div>
                )}
                {outcome && (
                  <div>
                    <div className="mb-1 flex items-center gap-2 text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
                      {t.result} · {outcome.durationMs}ms
                      {outcome.result.isError && (
                        <span className="normal-case text-rose-300">{t.toolError}</span>
                      )}
                    </div>
                    {(outcome.result.content ?? [])
                      .filter(block => block.type === 'text')
                      .map((block, i) => (
                        <pre
                          key={i}
                          className="mb-2 max-h-80 overflow-auto whitespace-pre-wrap rounded border border-zinc-800 bg-zinc-900 p-2 font-mono text-[11px] text-zinc-200"
                        >
                          {block.text}
                        </pre>
                      ))}
                    <details>
                      <summary className="cursor-pointer text-[11px] text-zinc-500">JSON</summary>
                      <pre className="mt-1 max-h-80 overflow-auto rounded border border-zinc-800 bg-zinc-900 p-2 font-mono text-[11px] text-zinc-400">
                        {JSON.stringify(outcome.result, null, 2)}
                      </pre>
                    </details>
                  </div>
                )}
              </div>
            )}
          </section>
        </div>
      )}
    </div>
  );
}
