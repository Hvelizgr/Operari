'use client';

import { RefreshCw, Server, ShieldAlert } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';

export interface RegisteredServer {
  id: string;
  name: string;
  host: string;
  port: number;
  username: string;
  hostKeyFingerprint: string;
  authMode: 'key' | 'certificate';
  sudoAllowed: boolean;
}

const STRINGS = {
  en: {
    none: 'Select a server',
    loading: 'Loading servers…',
    empty: 'No servers registered yet. An admin adds them in Settings → Servers.',
    failed: 'Could not load servers',
    refresh: 'Refresh',
    missing: 'This server is no longer registered.',
    sudo: 'sudo allowed',
    cert: 'certificate',
  },
  es: {
    none: 'Elegí un servidor',
    loading: 'Cargando servidores…',
    empty:
      'Todavía no hay servidores registrados. Un admin los agrega en Configuración → Servidores.',
    failed: 'No se pudieron cargar los servidores',
    refresh: 'Recargar',
    missing: 'Este servidor ya no está registrado.',
    sudo: 'sudo permitido',
    cert: 'certificado',
  },
} as const;

export default function ServerPicker({
  lang,
  value,
  onChange,
}: {
  lang: 'en' | 'es';
  value: string;
  onChange: (next: string) => void;
}) {
  const t = STRINGS[lang];
  const apiBase = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';
  const [servers, setServers] = useState<RegisteredServer[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const res = await fetch(`${apiBase}/api/servers`, { credentials: 'include' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = (await res.json()) as { data?: RegisteredServer[] };
      setServers(json.data ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setServers([]);
    }
  }, [apiBase]);

  useEffect(() => {
    void load();
  }, [load]);

  const selected = servers?.find(s => s.id === value);
  const inputClass =
    'w-full rounded border border-[var(--input-border)] bg-[var(--input-bg)] px-2 py-1.5 text-xs text-[var(--text-primary)] focus:border-primary focus:outline-none';

  return (
    <div className="space-y-1.5">
      <div className="flex items-center gap-1.5">
        <select
          value={value}
          onChange={e => onChange(e.target.value)}
          className={inputClass}
          disabled={servers === null}
          aria-label={t.none}
        >
          <option value="">{servers === null ? t.loading : t.none}</option>
          {servers?.map(s => (
            <option key={s.id} value={s.id}>
              {s.name} — {s.username}@{s.host}
              {s.port !== 22 ? `:${s.port}` : ''}
            </option>
          ))}
        </select>
        <button
          type="button"
          onClick={() => void load()}
          className="rounded p-1.5 text-[var(--text-muted)] hover:bg-white/10"
          title={t.refresh}
        >
          <RefreshCw size={12} />
        </button>
      </div>
      {error && <p className="text-[11px] text-red-400">{`${t.failed}: ${error}`}</p>}
      {servers?.length === 0 && !error && (
        <p className="text-[11px] text-[var(--text-muted)]">{t.empty}</p>
      )}
      {value && servers && !selected && (
        <p className="flex items-center gap-1 text-[11px] text-amber-400">
          <ShieldAlert size={12} /> {t.missing}
        </p>
      )}
      {selected && (
        <p className="flex flex-wrap items-center gap-x-2 text-[11px] text-[var(--text-muted)]">
          <Server size={11} />
          <code className="font-mono">{selected.hostKeyFingerprint}</code>
          {selected.authMode === 'certificate' && <span>· {t.cert}</span>}
          {selected.sudoAllowed && <span>· {t.sudo}</span>}
        </p>
      )}
    </div>
  );
}
