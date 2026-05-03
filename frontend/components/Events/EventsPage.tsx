'use client';

import { ChevronDown, ChevronRight, Search, ShieldCheck, Zap } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';

import { formatDateTime } from '@/lib/datetime';

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
      'Hash-chained immutable audit log of everything that happened in this tenant. Every run, approval, secret access, and config change is here.',
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
    [type, resource, cursor]
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
      <div className="mx-auto max-w-6xl px-6 py-8">
        <div className="mb-6 flex items-start justify-between">
          <div>
            <h1 className="flex items-center gap-2 text-2xl font-semibold text-white">
              <Zap size={22} className="text-yellow-400" />
              {t.title}
            </h1>
            <p className="mt-1 max-w-2xl text-sm text-gray-500">{t.subtitle}</p>
          </div>
          <button
            onClick={handleVerify}
            disabled={verifying}
            className="flex items-center gap-2 rounded-md bg-emerald-600 px-3 py-2 text-sm text-white hover:bg-emerald-500 disabled:opacity-50"
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
            {t.chainTitle}: <strong>{verify.intact ? t.chainIntact : t.chainBroken}</strong> ·{' '}
            {verify.eventCount} {t.chainEvents}
            {verify.firstBrokenSeq && <> · first broken seq: {verify.firstBrokenSeq}</>}
          </div>
        )}

        {error && (
          <div className="mb-4 rounded-md border border-red-900/50 bg-red-950/30 px-4 py-3 text-sm text-red-300">
            {t.loadError} · {error}
          </div>
        )}

        {/* Filters */}
        <div className="mb-5 flex items-center gap-3">
          <select
            value={type}
            onChange={e => setType(e.target.value)}
            className="focus:border-primary min-w-[180px] rounded-md border border-white/10 bg-[#1a1f2a] px-3 py-2 text-sm text-gray-300 focus:outline-none"
          >
            <option value="">{t.allTypes}</option>
            {types.map(tt => (
              <option key={tt.type} value={tt.type}>
                {tt.type} ({tt.count})
              </option>
            ))}
          </select>
          <div className="relative flex-1">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
            <input
              value={resource}
              onChange={e => setResource(e.target.value)}
              placeholder={t.searchPlaceholder}
              className="focus:border-primary w-full rounded-md border border-white/10 bg-[#1a1f2a] py-2 pl-9 pr-3 text-sm text-gray-200 focus:outline-none"
            />
          </div>
        </div>

        {events.length === 0 && !loading ? (
          <div className="rounded-md border border-white/10 bg-[#1a1f2a] px-6 py-12 text-center">
            <Zap size={32} className="mx-auto mb-3 text-gray-600" />
            <div className="mb-1 text-sm text-gray-400">{t.empty}</div>
          </div>
        ) : (
          <div className="overflow-hidden rounded-md border border-white/10 bg-[#1a1f2a]">
            <ul>
              {events.map(ev => (
                <li key={ev.id} className="border-b border-white/5 last:border-0">
                  <button
                    onClick={() => setExpandedId(expandedId === ev.id ? null : ev.id)}
                    className="flex w-full items-center gap-3 px-4 py-2 text-left hover:bg-white/[0.02]"
                  >
                    {expandedId === ev.id ? (
                      <ChevronDown size={12} className="text-gray-500" />
                    ) : (
                      <ChevronRight size={12} className="text-gray-500" />
                    )}
                    <span className="w-16 font-mono text-[10px] text-gray-600">#{ev.seq}</span>
                    <span className="text-primary/40 font-mono text-xs">{ev.type}</span>
                    <span className="flex-1 truncate text-xs text-gray-500">
                      {ev.resource ?? ''}
                    </span>
                    <span className="ml-auto text-[10px] text-gray-600">
                      {ev.actorType}/{ev.actorId?.slice(0, 8) ?? '—'}
                    </span>
                    <span className="w-32 text-right text-[10px] text-gray-600">
                      {formatDateTime(ev.createdAt, lang)}
                    </span>
                  </button>
                  {expandedId === ev.id && (
                    <div className="border-t border-white/5 bg-black/30 px-12 py-3">
                      <pre className="whitespace-pre-wrap break-all font-mono text-[11px] text-gray-300">
                        {JSON.stringify(ev.payload, null, 2)}
                      </pre>
                      <div className="mt-2 break-all font-mono text-[10px] text-gray-600">
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
                  className="text-primary/70 hover:text-primary/40 text-xs disabled:opacity-50"
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
