'use client';

import { ListFilter, Loader2 } from 'lucide-react';
import { useState } from 'react';

interface LoadedOption {
  name: string;
  value: string;
  also?: Record<string, string>;
}

const SECRET_REF_RE = /^\{\{\s*secrets\.([\w-]+)\s*\}\}$/;

const STRINGS = {
  en: {
    load: 'Load from account',
    loading: 'Loading…',
    pick: 'Pick one',
    needCredential: 'Pick a connected account in the credential field to list these.',
    empty: 'Nothing found with this account.',
  },
  es: {
    load: 'Cargar desde la cuenta',
    loading: 'Cargando…',
    pick: 'Elegí uno',
    needCredential: 'Elegí una cuenta conectada en el campo de credencial para listarlos.',
    empty: 'No se encontró nada con esta cuenta.',
  },
} as const;

/**
 * Fills a text field from the provider API (Slack channels, GitHub repos…)
 * through the step's own credential. The text input stays, so expressions
 * and ids typed by hand keep working.
 */
export default function OptionLoader({
  lang,
  loader,
  params = [],
  values,
  credentialField = 'credential',
  onPick,
}: {
  lang: 'en' | 'es';
  loader: string;
  params?: string[];
  values: Record<string, unknown>;
  credentialField?: string;
  onPick: (value: string, also?: Record<string, string>) => void;
}) {
  const t = STRINGS[lang];
  const apiBase = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';
  const [options, setOptions] = useState<LoadedOption[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const credential = values[credentialField];
  const accountId =
    typeof credential === 'string' ? (SECRET_REF_RE.exec(credential)?.[1] ?? null) : null;

  async function load() {
    if (!accountId) return;
    setLoading(true);
    setError(null);
    try {
      const body = {
        params: Object.fromEntries(
          params.map(p => [p, typeof values[p] === 'string' ? values[p] : ''])
        ),
      };
      const res = await fetch(
        `${apiBase}/api/connected-accounts/${encodeURIComponent(accountId)}/options/${encodeURIComponent(loader)}`,
        {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        }
      );
      const json = (await res.json().catch(() => ({}))) as {
        data?: LoadedOption[];
        error?: string;
      };
      if (!res.ok) throw new Error(json.error ?? `HTTP ${res.status}`);
      setOptions(json.data ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setOptions(null);
    } finally {
      setLoading(false);
    }
  }

  if (!accountId) {
    return <p className="mt-1 text-[10px] text-[var(--descriptor-color)]">{t.needCredential}</p>;
  }

  return (
    <div className="mt-1 space-y-1">
      {options && options.length > 0 ? (
        <select
          className="w-full rounded border border-[var(--border-color)] bg-[rgba(0,0,0,0.2)] p-1.5 text-xs text-[var(--body-text-color)] focus:border-[var(--highlight-color)] focus:outline-none"
          defaultValue=""
          aria-label={t.pick}
          onChange={e => {
            const picked = options.find(o => o.value === e.target.value);
            if (picked) onPick(picked.value, picked.also);
          }}
        >
          <option value="" disabled>
            {t.pick}
          </option>
          {options.map(o => (
            <option key={o.value} value={o.value}>
              {o.name}
            </option>
          ))}
        </select>
      ) : (
        <button
          type="button"
          onClick={() => void load()}
          disabled={loading}
          className="inline-flex items-center gap-1 text-[10px] text-[var(--highlight-color)] hover:underline disabled:opacity-50"
        >
          {loading ? <Loader2 size={10} className="animate-spin" /> : <ListFilter size={10} />}
          {loading ? t.loading : t.load}
        </button>
      )}
      {options && options.length === 0 && (
        <p className="text-[10px] text-[var(--descriptor-color)]">{t.empty}</p>
      )}
      {error && <p className="text-[10px] text-red-400">{error}</p>}
    </div>
  );
}
