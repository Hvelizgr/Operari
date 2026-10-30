'use client';

import { AlertCircle, KeyRound, RefreshCw } from 'lucide-react';
import { useEffect, useState } from 'react';

interface ConnectedAccount {
  id: string;
  provider: string;
  displayName: string | null;
  scopes: string[];
  createdAt: string;
  tokenExpiry: string | null;
}

interface SecretPickerProps {
  lang: 'en' | 'es';
  /** Current value, e.g. "{{secrets.acc-123}}" or a literal token */
  value: string;
  onChange: (next: string) => void;
  /** Optional provider filter (github, slack, ...) */
  provider?: string;
  label?: string;
}

const STRINGS: Record<'en' | 'es', Record<string, string>> = {
  en: {
    label: 'Credential',
    useSecret: 'Use a connected account',
    useLiteral: 'Use a literal value',
    loading: 'Loading credentials...',
    empty: 'No connected accounts yet.',
    empty2: 'Link one from Settings → Connected accounts.',
    loadFailed: 'Failed to load credentials',
    select: 'Select an account',
    refresh: 'Refresh',
    scopes: 'scopes',
  },
  es: {
    label: 'Credencial',
    useSecret: 'Usar una cuenta conectada',
    useLiteral: 'Usar un valor literal',
    loading: 'Cargando credenciales...',
    empty: 'Aún no hay cuentas conectadas.',
    empty2: 'Vincula una desde Ajustes → Cuentas conectadas.',
    loadFailed: 'No se pudieron cargar las credenciales',
    select: 'Selecciona una cuenta',
    refresh: 'Recargar',
    scopes: 'permisos',
  },
};

const SECRET_REF_RE = /^\{\{\s*secrets\.([\w-]+)\s*\}\}$/;

function parseSecretId(value: string): string | null {
  const m = SECRET_REF_RE.exec(value || '');
  return m ? m[1] : null;
}

export default function SecretPicker({
  lang,
  value,
  onChange,
  provider,
  label,
}: SecretPickerProps) {
  const t = STRINGS[lang] ?? STRINGS.en;
  const apiBase = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

  const initialMode: 'secret' | 'literal' = parseSecretId(value) ? 'secret' : 'literal';
  const [mode, setMode] = useState<'secret' | 'literal'>(initialMode);
  const [accounts, setAccounts] = useState<ConnectedAccount[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (provider) params.set('provider', provider);
      const res = await fetch(`${apiBase}/api/connected-accounts?${params}`, {
        credentials: 'include',
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      setAccounts(json.data || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (mode === 'secret') load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, provider]);

  const selectedId = parseSecretId(value);
  const inputClass =
    'w-full bg-black/20 border border-[var(--border-color)] rounded p-2 text-sm text-[var(--body-text-color)] focus:outline-none focus:border-[var(--highlight-color)] transition-colors font-mono';

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <label className="block text-[11px] font-bold uppercase text-[var(--descriptor-color)]">
          {label ?? t.label}
        </label>
        <div className="flex items-center gap-2 text-[10px] text-[var(--descriptor-color)]">
          <button
            type="button"
            onClick={() => setMode('secret')}
            className={
              mode === 'secret'
                ? 'font-bold text-[var(--highlight-color)]'
                : 'opacity-70 hover:opacity-100'
            }
          >
            {t.useSecret}
          </button>
          <span className="opacity-50">|</span>
          <button
            type="button"
            onClick={() => setMode('literal')}
            className={
              mode === 'literal'
                ? 'font-bold text-[var(--highlight-color)]'
                : 'opacity-70 hover:opacity-100'
            }
          >
            {t.useLiteral}
          </button>
        </div>
      </div>

      {mode === 'literal' && (
        <input
          type="password"
          value={value}
          placeholder="••••••"
          onChange={e => onChange(e.target.value)}
          className={inputClass}
        />
      )}

      {mode === 'secret' && (
        <div className="space-y-2">
          {loading && (
            <div className="flex items-center gap-2 text-xs text-[var(--descriptor-color)]">
              <RefreshCw size={12} className="animate-spin" />
              {t.loading}
            </div>
          )}

          {error && !loading && (
            <div className="flex items-start gap-2 rounded border border-red-900 bg-red-950/30 px-2 py-1.5 text-xs text-red-300">
              <AlertCircle size={12} className="mt-0.5 shrink-0" />
              <span>
                {t.loadFailed}: {error}
              </span>
            </div>
          )}

          {!loading && !error && accounts.length === 0 && (
            <div className="rounded border border-[var(--border-color)] bg-black/20 px-3 py-2 text-xs text-[var(--descriptor-color)]">
              <div>{t.empty}</div>
              <div className="mt-0.5 opacity-70">{t.empty2}</div>
            </div>
          )}

          {!loading && accounts.length > 0 && (
            <>
              <select
                value={selectedId ?? ''}
                onChange={e => {
                  const id = e.target.value;
                  onChange(id ? `{{secrets.${id}}}` : '');
                }}
                className={inputClass}
              >
                <option value="">{t.select}</option>
                {accounts.map(a => (
                  <option key={a.id} value={a.id}>
                    {a.provider}
                    {a.displayName ? ` — ${a.displayName}` : ''}
                  </option>
                ))}
              </select>
              {selectedId && (
                <SelectedAccountSummary
                  account={accounts.find(a => a.id === selectedId)}
                  scopesLabel={t.scopes}
                />
              )}
            </>
          )}

          <button
            type="button"
            onClick={load}
            className="flex items-center gap-1 text-[10px] text-[var(--descriptor-color)] hover:text-[var(--highlight-color)]"
          >
            <RefreshCw size={10} /> {t.refresh}
          </button>
        </div>
      )}
    </div>
  );
}

function SelectedAccountSummary({
  account,
  scopesLabel,
}: {
  account?: ConnectedAccount;
  scopesLabel: string;
}) {
  if (!account) return null;
  return (
    <div className="rounded border border-[var(--border-color)] bg-black/20 px-2 py-1.5 text-[10px] text-[var(--descriptor-color)]">
      <div className="flex items-center gap-1 font-mono text-[var(--body-text-color)]">
        <KeyRound size={10} /> {account.id}
      </div>
      {account.scopes.length > 0 && (
        <div className="mt-0.5 opacity-70">
          {scopesLabel}: {account.scopes.join(', ')}
        </div>
      )}
    </div>
  );
}
