'use client';

import {
  BookOpen,
  ChevronDown,
  ChevronRight,
  Code2,
  Columns3,
  Database,
  Filter,
  HelpCircle,
  Network,
  PanelLeft,
  Play,
  RefreshCw,
  Table2,
  X,
} from 'lucide-react';
import dynamic from 'next/dynamic';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useHotkeys } from 'react-hotkeys-hook';
import { Group, Panel, Separator } from 'react-resizable-panels';

import { hasCapability } from '@operari/shared';
import { chipButton } from '@/components/ui/buttonVariants';
import { sqlMetadataSchema, type SqlMetadata } from '@/lib/sql/metadata';
import { useSqlPrefs } from '@/lib/userPrefs';

import ConvertToStepButton from './ConvertToStepButton';
import { QUERY_TEMPLATE_CATEGORIES, QUERY_TEMPLATES } from './queryTemplates';
import { detectActiveVerb, SQLHelpDrawer } from './SQLHelpDrawer';

import SQLCodeEditor from './SQLCodeEditor';
import SQLResultsTable, { type SQLError, type SQLResult } from './SQLResultsTable';

// SchemaDiagram pulls elkjs + the React Flow surface — both are heavy
// and only needed when the operator switches to the diagram tab.
// `dynamic` keeps the SQL-editor default load lean.
const SchemaDiagram = dynamic(() => import('./SchemaDiagram'), {
  ssr: false,
  loading: () => (
    <div className="flex h-full items-center justify-center text-xs text-zinc-500">
      Loading diagram…
    </div>
  ),
});

/**
 * Strip comments + literal strings from a SQL query so simple regex
 * checks below can scan the actual statement structure without
 * tripping on a `-- DELETE` comment or a `'DROP TABLE'` literal.
 */
function stripCommentsAndStrings(sql: string): string {
  return sql
    .replace(/--[^\n]*/g, ' ')
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/'(?:''|[^'])*'/g, "''")
    .replace(/"(?:""|[^"])*"/g, '""');
}

/** True when the query top-level is DROP, TRUNCATE, or DELETE/UPDATE
 *  without a WHERE clause — i.e. the cases worth a confirmation. */
function isDestructive(rawSql: string): boolean {
  const sql = stripCommentsAndStrings(rawSql).trim();
  if (/^\s*(drop|truncate)\b/i.test(sql)) return true;
  if (/^\s*(delete|update)\b/i.test(sql) && !/\bwhere\b/i.test(sql)) return true;
  return false;
}

/** Wrap a SELECT without explicit LIMIT / FETCH FIRST in a LIMIT N
 *  clause so the user's row-cap pref applies. Other statement kinds
 *  (DDL, INSERT, etc.) pass through unchanged. */
function applyDefaultRowLimit(rawSql: string, limit: number): string {
  const trimmed = rawSql.trim().replace(/;\s*$/, '');
  const naked = stripCommentsAndStrings(trimmed);
  if (!/^\s*select\b/i.test(naked)) return rawSql;
  if (/\blimit\s+\d+/i.test(naked) || /\bfetch\s+first\b/i.test(naked)) return rawSql;
  return `${trimmed}\nLIMIT ${limit}`;
}

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

interface SchemaTable {
  schema: string;
  name: string;
  columns: { name: string; type: string; nullable: boolean; default: string | null }[];
}

interface ConnectedAccount {
  id: string;
  displayName: string | null;
  provider: string;
}

export default function SQLEditorCanvas({ lang }: { lang: 'en' | 'es' }) {
  // User preferences from /settings → SQL editor. Hoisted to the top
  // so every effect / callback below can read defaults without a
  // declaration-order trap.
  const [sqlPrefs] = useSqlPrefs();

  // State
  const [query, setQuery] = useState('SELECT 1 AS test;');
  const [credentialId, setCredentialId] = useState<string>('');

  // Reverse handoff from the runbook editor — when an operator
  // clicked "Open in SQL Editor" on an `operari.database` step,
  // the editor stashed the query + credentialId under
  // `operari:prefillSqlEditor`. Read it on mount, prefill the
  // form, then clear so a refresh doesn't re-prefill stale data.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const raw = window.localStorage.getItem('operari:prefillSqlEditor');
    if (!raw) return;
    try {
      const parsed = JSON.parse(raw) as {
        query?: string;
        credentialId?: string;
      };
      if (typeof parsed.query === 'string' && parsed.query.length > 0) {
        setQuery(parsed.query);
      }
      if (typeof parsed.credentialId === 'string' && parsed.credentialId.length > 0) {
        setCredentialId(parsed.credentialId);
      }
    } catch {
      // bad JSON — drop it so we don't keep retrying on every mount
    }
    window.localStorage.removeItem('operari:prefillSqlEditor');
  }, []);

  const [credentials, setCredentials] = useState<ConnectedAccount[]>([]);
  const [schema, setSchema] = useState<SchemaTable[]>([]);
  const [expandedTables, setExpandedTables] = useState<Set<string>>(new Set());
  const [result, setResult] = useState<SQLResult | null>(null);
  const [error, setError] = useState<SQLError | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isSchemaLoading, setIsSchemaLoading] = useState(false);
  // Schema drawer is open by default on desktop (tailwind lg:flex
  // takes over), and closed on mobile until the user taps the toggle.
  // A 256px sidebar stealing ~65% of a 390px viewport is why this
  // whole page was unusable on phones.
  const [schemaOpenMobile, setSchemaOpenMobile] = useState(false);

  // Diagram view: lazy-loaded because elkjs + React Flow are heavy
  // and most SQL-editor sessions never open the diagram. Metadata is
  // fetched separately from the lightweight schema scan so we keep
  // the sidebar fast and only pay the rich-introspection cost on
  // first diagram open.
  const [view, setView] = useState<'editor' | 'diagram'>('editor');
  const [metadata, setMetadata] = useState<SqlMetadata | null>(null);
  const [metadataError, setMetadataError] = useState<string | null>(null);
  const [isMetadataLoading, setIsMetadataLoading] = useState(false);
  const [hiddenSchemas, setHiddenSchemas] = useState<Set<string>>(() => new Set());
  const [templatesOpen, setTemplatesOpen] = useState(false);
  // Cheatsheet drawer — slide-in panel with SELECT/INSERT/UPDATE/DELETE
  // syntax + constraints reminder. Toggled from the toolbar (?) and
  // dismissed via Esc / backdrop click.
  const [helpOpen, setHelpOpen] = useState(false);

  const selectedCredential = useMemo(
    () => credentials.find(c => c.id === credentialId) ?? null,
    [credentials, credentialId]
  );
  // Gate the Diagram tab on whether the selected provider can be
  // introspected. Postgres/MySQL → on; OAuth providers (slack,
  // github) → off, with an explanatory tooltip.
  const canShowDiagram = selectedCredential
    ? hasCapability(selectedCredential.provider, 'canIntrospectSchema')
    : false;

  const t =
    lang === 'es'
      ? {
          title: 'SQL Editor',
          run: 'Ejecutar',
          runHint: 'Ctrl+Enter',
          credential: 'Conexión',
          schema: 'Schema',
          noCredentials: 'No hay conexiones PostgreSQL configuradas',
          selectCredential: 'Selecciona una conexión',
          loadSchema: 'Cargar schema',
          loadingSchema: 'Cargando schema…',
          noTables: 'No se encontraron tablas',
          results: 'Resultados',
          editor: 'Editor',
          diagram: 'Diagrama',
          metadataError: 'No se pudo cargar el diagrama',
          schemasFilter: 'Schemas visibles',
          retry: 'Reintentar',
        }
      : {
          title: 'SQL Editor',
          run: 'Run',
          runHint: 'Ctrl+Enter',
          credential: 'Connection',
          schema: 'Schema',
          noCredentials: 'No PostgreSQL connections configured',
          selectCredential: 'Select a connection',
          loadSchema: 'Load schema',
          loadingSchema: 'Loading schema…',
          noTables: 'No tables found',
          results: 'Results',
          editor: 'Editor',
          diagram: 'Diagram',
          metadataError: 'Failed to load diagram',
          schemasFilter: 'Visible schemas',
          retry: 'Retry',
        };

  // Load credentials — fires once on mount. Reading `credentialId`
  // inside is only to avoid clobbering an already-selected one
  // if the fetch races with a user click; re-running on
  // credentialId changes would re-fetch the whole list for nothing.
  useEffect(() => {
    fetch(`${API_BASE}/api/connected-accounts?provider=postgres`, {
      credentials: 'include',
    })
      .then(r => (r.ok ? r.json() : []))
      .then(data => {
        const accounts = Array.isArray(data) ? data : (data.accounts ?? []);
        setCredentials(accounts);
        if (accounts.length > 0 && !credentialId) {
          setCredentialId(accounts[0].id);
        }
      })
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Load schema when credential changes
  const loadSchema = useCallback(async () => {
    if (!credentialId) return;
    setIsSchemaLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/sql/schema`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ credentialId }),
      });
      if (res.ok) {
        const data = await res.json();
        setSchema(data.tables ?? []);
      }
    } catch {
      /* ignore */
    }
    setIsSchemaLoading(false);
  }, [credentialId]);

  useEffect(() => {
    // The auto-load opt-out is for users with hundreds of tables —
    // they prefer the explicit refresh button so opening the editor
    // doesn't pull megabytes of catalog they may not need.
    if (credentialId && sqlPrefs.autoLoadSchema) loadSchema();
  }, [credentialId, loadSchema, sqlPrefs.autoLoadSchema]);

  // Apply showSystemSchemas filter on the rendered tree. The fetch
  // pulls everything; this just hides pg_catalog / information_schema
  // when the user wants a clean view.
  const visibleSchemaTree = useMemo(() => {
    if (sqlPrefs.showSystemSchemas) return schema;
    return schema.filter(t => t.schema !== 'pg_catalog' && t.schema !== 'information_schema');
  }, [schema, sqlPrefs.showSystemSchemas]);

  // Rich metadata for the diagram. Reset on credential change so the
  // operator never sees one connection's tables on top of another's
  // diagram, then fetch on demand the first time the diagram tab is
  // opened.
  useEffect(() => {
    setMetadata(null);
    setMetadataError(null);
    setHiddenSchemas(new Set());
  }, [credentialId]);

  const loadMetadata = useCallback(async () => {
    if (!credentialId) return;
    setIsMetadataLoading(true);
    setMetadataError(null);
    try {
      const res = await fetch(`${API_BASE}/api/sql/metadata`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ credentialId }),
      });
      const body = await res.json();
      if (!res.ok) {
        setMetadataError(body?.error ?? 'Metadata load failed');
        setMetadata(null);
        return;
      }
      const parsed = sqlMetadataSchema.safeParse(body);
      if (!parsed.success) {
        setMetadataError('Unexpected metadata shape from server');
        setMetadata(null);
        return;
      }
      setMetadata(parsed.data);
    } catch (err) {
      setMetadataError(err instanceof Error ? err.message : 'Network error');
    } finally {
      setIsMetadataLoading(false);
    }
  }, [credentialId]);

  useEffect(() => {
    if (view === 'diagram' && credentialId && !metadata && !isMetadataLoading && !metadataError) {
      loadMetadata();
    }
  }, [view, credentialId, metadata, isMetadataLoading, metadataError, loadMetadata]);

  const visibleSchemas = useMemo<ReadonlySet<string> | undefined>(() => {
    if (!metadata) return undefined;
    if (hiddenSchemas.size === 0) return undefined;
    const all = new Set(metadata.tables.map(t => t.schema));
    for (const hidden of hiddenSchemas) all.delete(hidden);
    return all;
  }, [metadata, hiddenSchemas]);

  const allSchemas = useMemo(() => {
    if (!metadata) return [] as string[];
    return Array.from(new Set(metadata.tables.map(tbl => tbl.schema))).sort();
  }, [metadata]);

  const toggleSchemaVisibility = (schema: string) => {
    setHiddenSchemas(prev => {
      const next = new Set(prev);
      if (next.has(schema)) next.delete(schema);
      else next.add(schema);
      return next;
    });
  };

  // Execute query
  const runQuery = useCallback(async () => {
    if (!credentialId || !query.trim()) return;

    // Confirm-destructive gate. Looks for top-level DROP / TRUNCATE
    // or DELETE / UPDATE without WHERE. Comments and whitespace are
    // stripped before the regex so a `-- DELETE` line doesn't trip
    // the prompt.
    if (sqlPrefs.confirmDestructive && isDestructive(query)) {
      const ok = window.confirm(
        lang === 'es'
          ? 'Esta query parece destructiva (DROP / TRUNCATE / DELETE-UPDATE sin WHERE). ¿Ejecutar igual?'
          : 'This query looks destructive (DROP / TRUNCATE / DELETE-UPDATE without WHERE). Run anyway?'
      );
      if (!ok) return;
    }

    // Auto-LIMIT — wrap SELECTs that don't already cap their output.
    // Skips when the user has explicit LIMIT / FETCH FIRST or when the
    // query is anything other than a SELECT (DDL, INSERT, etc.). This
    // is a frontend convenience; the backend still runs whatever we
    // send so a user can opt out by writing their own LIMIT.
    const wrappedQuery = applyDefaultRowLimit(query, sqlPrefs.defaultRowLimit);

    setIsLoading(true);
    setError(null);
    setResult(null);
    try {
      const res = await fetch(`${API_BASE}/api/sql/query`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          credentialId,
          query: wrappedQuery,
          timeout: sqlPrefs.queryTimeoutMs,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        setResult(data);
      } else {
        setError(data);
      }
    } catch (err) {
      setError({ error: err instanceof Error ? err.message : 'Network error' });
    }
    setIsLoading(false);
  }, [credentialId, query, sqlPrefs, lang]);

  // Insert table/column name into editor
  const insertText = useCallback((text: string) => {
    setQuery(prev => prev + text);
  }, []);

  // `?` toggles the SQL help drawer (GitHub-style). react-hotkeys-hook
  // skips form tags by default so the operator can still type a literal
  // `?` inside the editor or any text input. Esc handling lives inside
  // the drawer.
  useHotkeys('shift+/', () => setHelpOpen(open => !open), { preventDefault: true });

  const toggleTable = (tableName: string) => {
    setExpandedTables(prev => {
      const next = new Set(prev);
      if (next.has(tableName)) next.delete(tableName);
      else next.add(tableName);
      return next;
    });
  };

  return (
    <div className="flex h-screen w-full bg-zinc-950 text-zinc-200">
      {/* Mobile schema drawer backdrop. Dismisses the drawer when the
          user taps outside — the drawer itself stops propagation. */}
      {schemaOpenMobile && (
        <button
          type="button"
          aria-label="Close schema"
          onClick={() => setSchemaOpenMobile(false)}
          className="fixed inset-0 z-30 bg-black/50 lg:hidden"
        />
      )}
      {/* Schema Sidebar — static column on desktop, slide-in drawer on mobile. */}
      <div
        className={`fixed inset-y-0 left-0 z-40 w-72 max-w-[85vw] flex-col border-r border-zinc-800 bg-zinc-950 transition-transform lg:static lg:w-64 lg:max-w-none lg:translate-x-0 ${
          schemaOpenMobile ? 'flex translate-x-0' : 'hidden -translate-x-full lg:flex'
        }`}
      >
        <div className="flex items-center justify-between border-b border-zinc-800 bg-zinc-900/50 px-3 py-2.5">
          <span className="text-xs font-semibold uppercase tracking-wide text-zinc-300">
            {t.schema}
          </span>
          <div className="flex items-center gap-1">
            <button
              onClick={loadSchema}
              disabled={isSchemaLoading}
              className="p-1 text-zinc-500 transition-colors hover:text-white disabled:opacity-30"
              title={t.loadSchema}
              aria-label={t.loadSchema}
            >
              <RefreshCw size={13} className={isSchemaLoading ? 'animate-spin' : ''} />
            </button>
            <button
              onClick={() => setSchemaOpenMobile(false)}
              className="p-1 text-zinc-500 transition-colors hover:text-white lg:hidden"
              aria-label="Close schema"
            >
              <X size={14} />
            </button>
          </div>
        </div>
        <div className="flex-1 overflow-auto text-xs">
          {visibleSchemaTree.length === 0 ? (
            <div className="flex items-center justify-center gap-2 p-4 text-center text-zinc-600">
              {credentialId ? (
                isSchemaLoading ? (
                  <>
                    <RefreshCw size={12} className="animate-spin text-zinc-500" />
                    <span>{t.loadingSchema}</span>
                  </>
                ) : (
                  t.noTables
                )
              ) : (
                t.selectCredential
              )}
            </div>
          ) : (
            visibleSchemaTree.map(table => {
              const fullName = `${table.schema}.${table.name}`;
              const isExpanded = expandedTables.has(fullName);
              return (
                <div key={fullName}>
                  <button
                    onClick={() => toggleTable(fullName)}
                    onDoubleClick={() => insertText(table.name)}
                    className="flex w-full items-center gap-1.5 px-3 py-1.5 text-left transition-colors hover:bg-zinc-800/50"
                    title={`Double-click to insert "${table.name}"`}
                  >
                    {isExpanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                    <Table2 size={12} className="text-primary/70 shrink-0" />
                    <span className="truncate text-zinc-300">{table.name}</span>
                    <span className="ml-auto text-zinc-600">{table.columns.length}</span>
                  </button>
                  {isExpanded && (
                    <div className="pb-1 pl-8">
                      {table.columns.map(col => (
                        <button
                          key={col.name}
                          onClick={() => insertText(col.name)}
                          className="flex w-full items-center gap-1.5 px-2 py-0.5 text-left transition-colors hover:bg-zinc-800/30"
                          title={`${col.type}${col.nullable ? ' (nullable)' : ''}`}
                        >
                          <Columns3 size={10} className="shrink-0 text-zinc-600" />
                          <span className="truncate text-zinc-400">{col.name}</span>
                          <span className="ml-auto text-[10px] text-zinc-700">{col.type}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Main Area */}
      <div className="flex min-w-0 flex-1 flex-col">
        {/* Top Bar */}
        <div className="flex h-11 shrink-0 items-center gap-2 border-b border-zinc-800 bg-zinc-900/50 px-3 sm:gap-3 sm:px-4">
          <button
            onClick={() => setSchemaOpenMobile(true)}
            className="p-1 text-zinc-400 transition-colors hover:text-white lg:hidden"
            aria-label="Open schema"
          >
            <PanelLeft size={16} />
          </button>
          <Database size={16} className="text-primary/70 hidden sm:block" />
          <span className="text-sm font-semibold text-white">{t.title}</span>

          <div className="mx-1 hidden h-5 w-px bg-zinc-700 sm:block" />

          {/* Credential selector */}
          <select
            value={credentialId}
            onChange={e => setCredentialId(e.target.value)}
            className="focus:border-primary min-w-0 max-w-[140px] rounded border border-zinc-700 bg-zinc-800 px-2 py-1 text-xs text-zinc-200 focus:outline-none sm:max-w-xs"
          >
            {credentials.length === 0 && <option value="">{t.noCredentials}</option>}
            {credentials.map(c => (
              <option key={c.id} value={c.id}>
                {c.displayName || c.id}
              </option>
            ))}
          </select>

          <div className="flex-1" />

          {/* Editor / Diagram toggle. We render two segments instead of
              a dropdown so the active view is visible at a glance and
              switching costs one click. */}
          <div
            className="flex overflow-hidden rounded border border-zinc-700 bg-zinc-800"
            role="tablist"
            aria-label={`${t.editor} / ${t.diagram}`}
          >
            <button
              type="button"
              role="tab"
              aria-selected={view === 'editor'}
              onClick={() => setView('editor')}
              className={`flex items-center gap-1 px-2 py-1 text-[11px] transition-colors ${
                view === 'editor' ? 'bg-zinc-700 text-white' : 'text-zinc-400 hover:text-white'
              }`}
            >
              <Code2 size={11} />
              <span className="hidden sm:inline">{t.editor}</span>
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={view === 'diagram'}
              onClick={() => setView('diagram')}
              disabled={!credentialId || !canShowDiagram}
              title={
                !canShowDiagram && selectedCredential
                  ? lang === 'es'
                    ? `${selectedCredential.provider} no soporta introspección de schema`
                    : `${selectedCredential.provider} doesn't support schema introspection`
                  : undefined
              }
              className={`flex items-center gap-1 px-2 py-1 text-[11px] transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${
                view === 'diagram' ? 'bg-zinc-700 text-white' : 'text-zinc-400 hover:text-white'
              }`}
            >
              <Network size={11} />
              <span className="hidden sm:inline">{t.diagram}</span>
            </button>
          </div>

          {/* Templates dropdown — quick access to canned PG queries
              (table sizes, active queries, blocking locks, etc.) so
              the operator doesn't have to remember system-view names
              under pressure. Click an entry to load it into the
              editor. */}
          {view === 'editor' ? (
            <div className="relative">
              <button
                type="button"
                onClick={() => setTemplatesOpen(v => !v)}
                className={chipButton({ tone: 'neutral' })}
                title={lang === 'es' ? 'Plantillas de query' : 'Query templates'}
              >
                <BookOpen size={11} />
                <span>{lang === 'es' ? 'Plantillas' : 'Templates'}</span>
              </button>
              {templatesOpen ? (
                <div className="absolute right-0 top-full z-30 mt-1 max-h-[60vh] w-80 overflow-auto rounded-lg border border-zinc-700 bg-zinc-900/95 p-2 text-xs shadow-2xl backdrop-blur">
                  {QUERY_TEMPLATE_CATEGORIES.map(cat => {
                    const items = QUERY_TEMPLATES.filter(q => q.category === cat.id);
                    if (items.length === 0) return null;
                    return (
                      <div key={cat.id} className="mb-1 last:mb-0">
                        <div className="px-1 pb-1 pt-1 text-[9px] font-bold uppercase tracking-wider text-zinc-500">
                          {cat.label[lang]}
                        </div>
                        {items.map(tpl => (
                          <button
                            key={tpl.id}
                            type="button"
                            onClick={() => {
                              setQuery(tpl.sql);
                              setTemplatesOpen(false);
                            }}
                            className="flex w-full flex-col items-start gap-0.5 rounded px-2 py-1.5 text-left transition-colors hover:bg-zinc-800"
                          >
                            <span className="text-zinc-200">{tpl.label[lang]}</span>
                            <span className="text-[10px] text-zinc-500">
                              {tpl.description[lang]}
                            </span>
                          </button>
                        ))}
                      </div>
                    );
                  })}
                </div>
              ) : null}
            </div>
          ) : null}

          {/* Help drawer toggle — slide-in cheatsheet. Visible on both
              editor + diagram views since the constraints + JOIN
              sections help diagram readers too. Keyboard: `?`. */}
          <button
            type="button"
            onClick={() => setHelpOpen(o => !o)}
            className={chipButton({ tone: helpOpen ? 'primary' : 'neutral' })}
            title={lang === 'es' ? 'Ayuda SQL  (?)' : 'SQL help  (?)'}
            aria-label={lang === 'es' ? 'Abrir ayuda SQL' : 'Open SQL help'}
          >
            <HelpCircle size={11} />
            <span className="hidden sm:inline">{lang === 'es' ? 'Ayuda' : 'Help'}</span>
            <kbd className="hidden rounded bg-zinc-800 px-1 font-mono text-[9px] text-zinc-400 sm:inline">
              ?
            </kbd>
          </button>

          {/* "Save as runbook step" — handoff to the editor.
              Editor-only because the diagram tab has no live query
              to capture. Only enabled when the operator has a real
              query against a real connection — empty payload would
              just trip on form validation in the editor. */}
          {view === 'editor' ? (
            <ConvertToStepButton query={query} credentialId={credentialId} lang={lang} />
          ) : null}

          {/* Run button (editor view only — meaningless on diagram tab). */}
          {view === 'editor' ? (
            <button
              onClick={runQuery}
              disabled={isLoading || !credentialId || !query.trim()}
              className="flex items-center gap-1.5 rounded bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-emerald-500 disabled:bg-zinc-700 disabled:text-zinc-500"
            >
              <Play size={12} />
              {t.run}
              <span className="ml-1 text-[10px] text-emerald-300/60">{t.runHint}</span>
            </button>
          ) : null}
        </div>

        {/* View body — switches between the editor + results split and
            the schema diagram. We unmount the diagram (instead of
            CSS-hiding it) when not active so React Flow doesn't run
            its layout / measure loop in the background. */}
        {view === 'editor' ? (
          <Group
            orientation="vertical"
            id="operari-sql-editor-editor-results"
            className="flex min-h-0 flex-1 flex-col"
          >
            <Panel defaultSize={50} minSize={20} className="flex flex-col border-b border-zinc-800">
              <div className="border-b border-zinc-800/50 px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-zinc-600">
                {t.editor}
              </div>
              <div className="flex-1 overflow-hidden p-2">
                <SQLCodeEditor
                  value={query}
                  onChange={setQuery}
                  onRun={runQuery}
                  minHeight="160px"
                />
              </div>
            </Panel>

            <Separator className="group h-1 cursor-row-resize bg-zinc-800/50 transition-colors hover:bg-emerald-700/40 data-[dragging]:bg-emerald-600" />

            <Panel defaultSize={50} minSize={15} className="flex min-h-0 flex-col overflow-hidden">
              <div className="shrink-0 border-b border-zinc-800/50 px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-zinc-600">
                {t.results}
              </div>
              <div className="flex-1 overflow-auto">
                <SQLResultsTable
                  result={result}
                  error={error}
                  isLoading={isLoading}
                  lang={lang}
                  onRetry={runQuery}
                />
              </div>
            </Panel>
          </Group>
        ) : (
          <div className="relative flex min-h-0 flex-1">
            {metadataError ? (
              <div className="flex flex-1 flex-col items-center justify-center gap-2 text-center text-xs text-zinc-400">
                <span>{t.metadataError}</span>
                <span className="font-mono text-[10px] text-zinc-600">{metadataError}</span>
                <button
                  type="button"
                  onClick={loadMetadata}
                  className="mt-2 rounded border border-zinc-700 bg-zinc-800 px-3 py-1 text-[11px] text-zinc-200 transition-colors hover:bg-zinc-700"
                >
                  {t.retry}
                </button>
              </div>
            ) : metadata ? (
              <>
                <SchemaDiagram metadata={metadata} visibleSchemas={visibleSchemas} lang={lang} />
                {allSchemas.length > 1 ? (
                  <div className="absolute right-3 top-3 z-10 max-h-[60%] w-44 overflow-auto rounded-lg border border-zinc-700 bg-zinc-900/95 p-2 text-[11px] shadow-xl backdrop-blur">
                    <div className="mb-1 flex items-center gap-1 text-[9px] font-bold uppercase tracking-wider text-zinc-500">
                      <Filter size={10} />
                      <span>{t.schemasFilter}</span>
                    </div>
                    {allSchemas.map(schemaName => (
                      <label
                        key={schemaName}
                        className="flex cursor-pointer items-center gap-1.5 rounded px-1 py-0.5 text-zinc-300 transition-colors hover:bg-zinc-800"
                      >
                        <input
                          type="checkbox"
                          checked={!hiddenSchemas.has(schemaName)}
                          onChange={() => toggleSchemaVisibility(schemaName)}
                          className="accent-emerald-500"
                        />
                        <span className="truncate font-mono">{schemaName}</span>
                      </label>
                    ))}
                  </div>
                ) : null}
              </>
            ) : (
              <div className="flex flex-1 flex-col items-center justify-center gap-2 text-xs text-zinc-500">
                <RefreshCw
                  size={14}
                  className={isMetadataLoading ? 'animate-spin' : 'opacity-40'}
                />
                <span>{t.loadingSchema}</span>
              </div>
            )}
          </div>
        )}
      </div>
      <SQLHelpDrawer
        open={helpOpen}
        onClose={() => setHelpOpen(false)}
        lang={lang}
        // Auto-jump: detect the verb of the current query and surface
        // the matching topic when the operator opens the drawer. The
        // detector is heuristic (no parser) so unknown text falls
        // back to the drawer's default landing topic without surfacing
        // a wrong section.
        initialTopicId={detectActiveVerb(query)}
        onInsertSnippet={sql => {
          // Bridge to the editor's existing insert path. Newlines
          // sandwich the snippet so it lands as a separate stanza
          // rather than mashing into whatever was on the cursor line.
          insertText(`\n${sql}\n`);
          setHelpOpen(false);
        }}
      />
    </div>
  );
}
