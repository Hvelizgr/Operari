'use client';

import { useCallback, useEffect, useState } from 'react';
import { Zap, ShieldCheck, Search, ChevronDown, ChevronRight } from 'lucide-react';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

interface Event {
    id: string;
    seq: string;
    type: string;
    actorId: string | null;
    actorType: string | null;
    resource: string | null;
    payload: unknown;
    hash: string;
    createdAt: string;
}

interface EventTypeCount {
    type: string;
    count: number;
}

interface VerifyResult {
    intact: boolean;
    eventCount: number;
    firstBrokenSeq: string | null;
}

const STRINGS = {
    en: {
        title: 'Events',
        subtitle:
            "Hash-chained immutable audit log of everything that happened in this tenant. Every run, approval, secret access, and config change is here.",
        chainTitle: 'Audit chain',
        chainIntact: 'intact',
        chainBroken: 'broken',
        chainEvents: 'events',
        verify: 'Verify chain',
        verifying: 'Verifying…',
        searchPlaceholder: 'Filter by resource id…',
        allTypes: 'All types',
        empty: 'No events to show.',
        loading: 'Loading…',
        loadMore: 'Load more',
        loadError: 'Failed to load events.',
    },
    es: {
        title: 'Eventos',
        subtitle:
            'Log de auditoría inmutable encadenado por hash de todo lo que pasó en este tenant. Cada ejecución, aprobación, acceso a secreto y cambio de config está acá.',
        chainTitle: 'Cadena de auditoría',
        chainIntact: 'íntegra',
        chainBroken: 'rota',
        chainEvents: 'eventos',
        verify: 'Verificar cadena',
        verifying: 'Verificando…',
        searchPlaceholder: 'Filtrar por id de recurso…',
        allTypes: 'Todos los tipos',
        empty: 'No hay eventos para mostrar.',
        loading: 'Cargando…',
        loadMore: 'Cargar más',
        loadError: 'Error cargando eventos.',
    },
} as const;

interface EventsPageProps {
    lang: 'en' | 'es';
}

export default function EventsPage({ lang }: EventsPageProps) {
    const t = STRINGS[lang];
    const [events, setEvents] = useState<Event[]>([]);
    const [types, setTypes] = useState<EventTypeCount[]>([]);
    const [type, setType] = useState('');
    const [resource, setResource] = useState('');
    const [cursor, setCursor] = useState<string | null>(null);
    const [hasMore, setHasMore] = useState(false);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [expandedId, setExpandedId] = useState<string | null>(null);
    const [verify, setVerify] = useState<VerifyResult | null>(null);
    const [verifying, setVerifying] = useState(false);

    const load = useCallback(
        async (reset: boolean) => {
            setLoading(true);
            try {
                const params = new URLSearchParams({ limit: '50' });
                if (type) params.set('type', type);
                if (resource) params.set('resource', resource);
                if (!reset && cursor) params.set('cursor', cursor);
                const res = await fetch(`${API_BASE}/api/events?${params}`);
                if (!res.ok) throw new Error(`HTTP ${res.status}`);
                const json = await res.json();
                setEvents(reset ? json.data : [...events, ...json.data]);
                setHasMore(!!json.nextCursor);
                setCursor(json.nextCursor ?? null);
                setError(null);
            } catch (e) {
                setError(e instanceof Error ? e.message : 'unknown');
            } finally {
                setLoading(false);
            }
        },
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [type, resource, cursor],
    );

    const fetchTypes = useCallback(async () => {
        try {
            const res = await fetch(`${API_BASE}/api/events/types`);
            if (res.ok) {
                const json = await res.json();
                setTypes(json.data);
            }
        } catch {
            /* noop */
        }
    }, []);

    useEffect(() => {
        fetchTypes();
    }, [fetchTypes]);

    useEffect(() => {
        const t = setTimeout(() => load(true), 200);
        return () => clearTimeout(t);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [type, resource]);

    const handleVerify = async () => {
        setVerifying(true);
        try {
            const res = await fetch(`${API_BASE}/api/v1/audit/verify`);
            if (res.ok) {
                const json = await res.json();
                setVerify({
                    intact: json.intact,
                    eventCount: json.eventCount,
                    firstBrokenSeq: json.firstBrokenSeq,
                });
            }
        } catch {
            /* noop */
        } finally {
            setVerifying(false);
        }
    };

    return (
        <div className="flex-1 overflow-y-auto bg-[#0f1218] text-gray-200">
            <div className="max-w-6xl mx-auto px-6 py-8">
                <div className="flex items-start justify-between mb-6">
                    <div>
                        <h1 className="text-2xl font-semibold text-white flex items-center gap-2">
                            <Zap size={22} className="text-yellow-400" />
                            {t.title}
                        </h1>
                        <p className="text-sm text-gray-500 mt-1 max-w-2xl">{t.subtitle}</p>
                    </div>
                    <button
                        onClick={handleVerify}
                        disabled={verifying}
                        className="flex items-center gap-2 px-3 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-sm rounded-md"
                    >
                        <ShieldCheck size={16} />
                        {verifying ? t.verifying : t.verify}
                    </button>
                </div>

                {verify && (
                    <div
                        className={`mb-4 rounded-md border px-4 py-3 text-sm ${
                            verify.intact
                                ? 'border-emerald-900/50 bg-emerald-950/30 text-emerald-300'
                                : 'border-red-900/50 bg-red-950/30 text-red-300'
                        }`}
                    >
                        {t.chainTitle}: <strong>{verify.intact ? t.chainIntact : t.chainBroken}</strong>{' '}
                        · {verify.eventCount} {t.chainEvents}
                        {verify.firstBrokenSeq && <> · first broken seq: {verify.firstBrokenSeq}</>}
                    </div>
                )}

                {error && (
                    <div className="mb-4 rounded-md border border-red-900/50 bg-red-950/30 px-4 py-3 text-sm text-red-300">
                        {t.loadError} · {error}
                    </div>
                )}

                {/* Filters */}
                <div className="flex items-center gap-3 mb-5">
                    <select
                        value={type}
                        onChange={(e) => setType(e.target.value)}
                        className="px-3 py-2 bg-[#1a1f2a] border border-white/10 rounded-md text-sm text-gray-300 focus:border-blue-500 focus:outline-none min-w-[180px]"
                    >
                        <option value="">{t.allTypes}</option>
                        {types.map((tt) => (
                            <option key={tt.type} value={tt.type}>
                                {tt.type} ({tt.count})
                            </option>
                        ))}
                    </select>
                    <div className="flex-1 relative">
                        <Search
                            size={14}
                            className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500"
                        />
                        <input
                            value={resource}
                            onChange={(e) => setResource(e.target.value)}
                            placeholder={t.searchPlaceholder}
                            className="w-full pl-9 pr-3 py-2 bg-[#1a1f2a] border border-white/10 rounded-md text-sm text-gray-200 focus:border-blue-500 focus:outline-none"
                        />
                    </div>
                </div>

                {events.length === 0 && !loading ? (
                    <div className="rounded-md border border-white/10 bg-[#1a1f2a] px-6 py-12 text-center">
                        <Zap size={32} className="mx-auto text-gray-600 mb-3" />
                        <div className="text-sm text-gray-400 mb-1">{t.empty}</div>
                    </div>
                ) : (
                    <div className="rounded-md border border-white/10 bg-[#1a1f2a] overflow-hidden">
                        <ul>
                            {events.map((ev) => (
                                <li
                                    key={ev.id}
                                    className="border-b border-white/5 last:border-0"
                                >
                                    <button
                                        onClick={() =>
                                            setExpandedId(expandedId === ev.id ? null : ev.id)
                                        }
                                        className="w-full px-4 py-2 flex items-center gap-3 text-left hover:bg-white/[0.02]"
                                    >
                                        {expandedId === ev.id ? (
                                            <ChevronDown size={12} className="text-gray-500" />
                                        ) : (
                                            <ChevronRight size={12} className="text-gray-500" />
                                        )}
                                        <span className="text-[10px] text-gray-600 font-mono w-16">
                                            #{ev.seq}
                                        </span>
                                        <span className="text-xs text-purple-300 font-mono">
                                            {ev.type}
                                        </span>
                                        <span className="text-xs text-gray-500 flex-1 truncate">
                                            {ev.resource ?? ''}
                                        </span>
                                        <span className="text-[10px] text-gray-600 ml-auto">
                                            {ev.actorType}/{ev.actorId?.slice(0, 8) ?? '—'}
                                        </span>
                                        <span className="text-[10px] text-gray-600 w-32 text-right">
                                            {new Date(ev.createdAt).toLocaleString()}
                                        </span>
                                    </button>
                                    {expandedId === ev.id && (
                                        <div className="px-12 py-3 bg-black/30 border-t border-white/5">
                                            <pre className="text-[11px] text-gray-300 font-mono whitespace-pre-wrap break-all">
                                                {JSON.stringify(ev.payload, null, 2)}
                                            </pre>
                                            <div className="text-[10px] text-gray-600 mt-2 font-mono break-all">
                                                hash: {ev.hash}
                                            </div>
                                        </div>
                                    )}
                                </li>
                            ))}
                        </ul>
                        {hasMore && (
                            <div className="border-t border-white/5 px-4 py-3 text-center">
                                <button
                                    onClick={() => load(false)}
                                    disabled={loading}
                                    className="text-xs text-blue-400 hover:text-blue-300 disabled:opacity-50"
                                >
                                    {loading ? t.loading : t.loadMore}
                                </button>
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}
