'use client';

import { useState, useCallback, useEffect } from 'react';
import {
    Database, Play, Table2, ChevronRight, ChevronDown,
    RefreshCw, Columns3,
} from 'lucide-react';
import SQLCodeEditor from './SQLCodeEditor';
import SQLResultsTable, { type SQLResult, type SQLError } from './SQLResultsTable';

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
    // State
    const [query, setQuery] = useState('SELECT 1 AS test;');
    const [credentialId, setCredentialId] = useState<string>('');
    const [credentials, setCredentials] = useState<ConnectedAccount[]>([]);
    const [schema, setSchema] = useState<SchemaTable[]>([]);
    const [expandedTables, setExpandedTables] = useState<Set<string>>(new Set());
    const [result, setResult] = useState<SQLResult | null>(null);
    const [error, setError] = useState<SQLError | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [isSchemaLoading, setIsSchemaLoading] = useState(false);

    const t = lang === 'es' ? {
        title: 'SQL Editor',
        run: 'Ejecutar',
        runHint: 'Ctrl+Enter',
        credential: 'Conexión',
        schema: 'Schema',
        noCredentials: 'No hay conexiones PostgreSQL configuradas',
        selectCredential: 'Selecciona una conexión',
        loadSchema: 'Cargar schema',
        results: 'Resultados',
        editor: 'Editor',
    } : {
        title: 'SQL Editor',
        run: 'Run',
        runHint: 'Ctrl+Enter',
        credential: 'Connection',
        schema: 'Schema',
        noCredentials: 'No PostgreSQL connections configured',
        selectCredential: 'Select a connection',
        loadSchema: 'Load schema',
        results: 'Results',
        editor: 'Editor',
    };

    // Load credentials
    useEffect(() => {
        fetch(`${API_BASE}/api/connected-accounts?provider=postgres`)
            .then(r => r.ok ? r.json() : [])
            .then(data => {
                const accounts = Array.isArray(data) ? data : data.accounts ?? [];
                setCredentials(accounts);
                if (accounts.length > 0 && !credentialId) {
                    setCredentialId(accounts[0].id);
                }
            })
            .catch(() => {});
    }, []);

    // Load schema when credential changes
    const loadSchema = useCallback(async () => {
        if (!credentialId) return;
        setIsSchemaLoading(true);
        try {
            const res = await fetch(`${API_BASE}/api/sql/schema`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ credentialId }),
            });
            if (res.ok) {
                const data = await res.json();
                setSchema(data.tables ?? []);
            }
        } catch { /* ignore */ }
        setIsSchemaLoading(false);
    }, [credentialId]);

    useEffect(() => {
        if (credentialId) loadSchema();
    }, [credentialId, loadSchema]);

    // Execute query
    const runQuery = useCallback(async () => {
        if (!credentialId || !query.trim()) return;
        setIsLoading(true);
        setError(null);
        setResult(null);
        try {
            const res = await fetch(`${API_BASE}/api/sql/query`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ credentialId, query }),
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
    }, [credentialId, query]);

    // Insert table/column name into editor
    const insertText = useCallback((text: string) => {
        setQuery(prev => prev + text);
    }, []);

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
            {/* Schema Sidebar */}
            <div className="w-64 border-r border-zinc-800 flex flex-col shrink-0">
                <div className="flex items-center justify-between px-3 py-2.5 border-b border-zinc-800 bg-zinc-900/50">
                    <span className="text-xs font-semibold text-zinc-300 uppercase tracking-wide">{t.schema}</span>
                    <button
                        onClick={loadSchema}
                        disabled={isSchemaLoading}
                        className="p-1 text-zinc-500 hover:text-white transition-colors disabled:opacity-30"
                        title={t.loadSchema}
                    >
                        <RefreshCw size={13} className={isSchemaLoading ? 'animate-spin' : ''} />
                    </button>
                </div>
                <div className="flex-1 overflow-auto text-xs">
                    {schema.length === 0 ? (
                        <div className="p-4 text-zinc-600 text-center">
                            {credentialId ? (isSchemaLoading ? '...' : 'No tables found') : t.selectCredential}
                        </div>
                    ) : (
                        schema.map((table) => {
                            const fullName = `${table.schema}.${table.name}`;
                            const isExpanded = expandedTables.has(fullName);
                            return (
                                <div key={fullName}>
                                    <button
                                        onClick={() => toggleTable(fullName)}
                                        onDoubleClick={() => insertText(table.name)}
                                        className="w-full flex items-center gap-1.5 px-3 py-1.5 hover:bg-zinc-800/50 transition-colors text-left"
                                        title={`Double-click to insert "${table.name}"`}
                                    >
                                        {isExpanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                                        <Table2 size={12} className="text-blue-400 shrink-0" />
                                        <span className="truncate text-zinc-300">{table.name}</span>
                                        <span className="ml-auto text-zinc-600">{table.columns.length}</span>
                                    </button>
                                    {isExpanded && (
                                        <div className="pl-8 pb-1">
                                            {table.columns.map((col) => (
                                                <button
                                                    key={col.name}
                                                    onClick={() => insertText(col.name)}
                                                    className="w-full flex items-center gap-1.5 px-2 py-0.5 hover:bg-zinc-800/30 transition-colors text-left"
                                                    title={`${col.type}${col.nullable ? ' (nullable)' : ''}`}
                                                >
                                                    <Columns3 size={10} className="text-zinc-600 shrink-0" />
                                                    <span className="truncate text-zinc-400">{col.name}</span>
                                                    <span className="ml-auto text-zinc-700 text-[10px]">{col.type}</span>
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
            <div className="flex flex-col flex-1 min-w-0">
                {/* Top Bar */}
                <div className="flex items-center gap-3 px-4 h-11 border-b border-zinc-800 bg-zinc-900/50 shrink-0">
                    <Database size={16} className="text-violet-400" />
                    <span className="text-sm font-semibold text-white">{t.title}</span>

                    <div className="w-px h-5 bg-zinc-700 mx-1" />

                    {/* Credential selector */}
                    <select
                        value={credentialId}
                        onChange={(e) => setCredentialId(e.target.value)}
                        className="bg-zinc-800 border border-zinc-700 rounded px-2 py-1 text-xs text-zinc-200 focus:outline-none focus:border-blue-500 max-w-xs"
                    >
                        {credentials.length === 0 && (
                            <option value="">{t.noCredentials}</option>
                        )}
                        {credentials.map((c) => (
                            <option key={c.id} value={c.id}>
                                {c.displayName || c.id}
                            </option>
                        ))}
                    </select>

                    <div className="flex-1" />

                    {/* Run button */}
                    <button
                        onClick={runQuery}
                        disabled={isLoading || !credentialId || !query.trim()}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 disabled:bg-zinc-700 disabled:text-zinc-500 text-white text-xs font-medium rounded transition-colors"
                    >
                        <Play size={12} />
                        {t.run}
                        <span className="text-emerald-300/60 text-[10px] ml-1">{t.runHint}</span>
                    </button>
                </div>

                {/* Editor + Results split */}
                <div className="flex flex-col flex-1 min-h-0">
                    {/* SQL Editor */}
                    <div className="flex flex-col border-b border-zinc-800" style={{ minHeight: '200px', maxHeight: '50%' }}>
                        <div className="px-3 py-1.5 text-[10px] font-bold uppercase text-zinc-600 tracking-wider border-b border-zinc-800/50">
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
                    </div>

                    {/* Results */}
                    <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
                        <div className="px-3 py-1.5 text-[10px] font-bold uppercase text-zinc-600 tracking-wider border-b border-zinc-800/50 shrink-0">
                            {t.results}
                        </div>
                        <div className="flex-1 overflow-auto">
                            <SQLResultsTable
                                result={result}
                                error={error}
                                isLoading={isLoading}
                                lang={lang}
                            />
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
