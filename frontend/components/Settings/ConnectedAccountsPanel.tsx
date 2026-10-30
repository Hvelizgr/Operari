'use client';

import { Check, Github, KeyRound, Link2Off, Loader2, ShieldAlert, Sparkles } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';

import AddCredentialForm from './AddCredentialForm';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

interface ConnectedAccount {
  id: string;
  provider: string;
  displayName: string | null;
  scopes: string[];
  createdAt: string;
  metadata?: { defaultModel?: string; baseUrl?: string };
}

const STRINGS = {
  en: {
    title: 'Connected accounts',
    hint: 'Credentials and AI providers your steps can use: link GitHub, or paste any API key, token or connection string. Everything is encrypted at rest, steps only hold a reference, and every read emits a `secret.accessed` audit event.',
    connectGithub: 'Connect GitHub',
    connecting: 'Connecting…',
    empty: 'No accounts linked yet.',
    disconnect: 'Disconnect',
    disconnecting: 'Disconnecting…',
    confirmDisconnect:
      'Remove this credential? Runbooks that reference it will start failing on the next run.',
    linkedFlash: 'GitHub account linked.',
    errorFlash: 'Could not link GitHub account.',
    scopes: 'Scopes',
  },
  es: {
    title: 'Cuentas conectadas',
    hint: 'Credenciales y proveedores de IA que pueden usar tus pasos: vinculá GitHub o pegá cualquier API key, token o connection string. Todo se encripta en reposo, los pasos solo guardan una referencia y cada lectura emite un evento de auditoría `secret.accessed`.',
    connectGithub: 'Conectar GitHub',
    connecting: 'Conectando…',
    empty: 'No hay cuentas vinculadas todavía.',
    disconnect: 'Desconectar',
    disconnecting: 'Desconectando…',
    confirmDisconnect:
      '¿Quitar esta credencial? Los runbooks que la referencian van a empezar a fallar en la próxima corrida.',
    linkedFlash: 'Cuenta de GitHub vinculada.',
    errorFlash: 'No se pudo vincular la cuenta de GitHub.',
    scopes: 'Permisos',
  },
} as const;

interface Props {
  lang: 'en' | 'es';
}

export default function ConnectedAccountsPanel({ lang }: Props) {
  const t = STRINGS[lang] ?? STRINGS.en;
  const [accounts, setAccounts] = useState<ConnectedAccount[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [linking, setLinking] = useState(false);
  const [unlinkingId, setUnlinkingId] = useState<string | null>(null);
  const [flash, setFlash] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null);

  const refresh = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/api/connected-accounts`, {
        credentials: 'include',
      });
      if (!res.ok) {
        setError(`HTTP ${res.status}`);
        return;
      }
      const body = (await res.json()) as { data?: ConnectedAccount[] };
      setAccounts(body.data ?? []);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Network error');
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  // Read ?ca_linked / ?ca_error left by the OAuth callback redirect.
  // Surface a one-shot flash and strip the query so a refresh doesn't
  // re-show it.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const linked = params.get('ca_linked');
    const errParam = params.get('ca_error');
    if (linked) {
      setFlash({ kind: 'ok', text: t.linkedFlash });
      params.delete('ca_linked');
      window.history.replaceState(
        null,
        '',
        `${window.location.pathname}${params.toString() ? `?${params}` : ''}`
      );
    } else if (errParam) {
      setFlash({ kind: 'err', text: `${t.errorFlash} (${errParam})` });
      params.delete('ca_error');
      window.history.replaceState(
        null,
        '',
        `${window.location.pathname}${params.toString() ? `?${params}` : ''}`
      );
    }
  }, [t.linkedFlash, t.errorFlash]);

  const handleConnectGithub = useCallback(async () => {
    setLinking(true);
    setFlash(null);
    try {
      const here = window.location.pathname;
      const startUrl = `${API_BASE}/api/connected-accounts/github/oauth/start?redirect=${encodeURIComponent(here)}`;
      const res = await fetch(startUrl, { credentials: 'include' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const body = (await res.json()) as { url: string };
      // Full-page redirect — GitHub's authorize page is the next view.
      window.location.assign(body.url);
    } catch (err) {
      setLinking(false);
      setFlash({
        kind: 'err',
        text: `${t.errorFlash}: ${err instanceof Error ? err.message : String(err)}`,
      });
    }
  }, [t.errorFlash]);

  const handleDisconnect = useCallback(
    async (id: string) => {
      if (typeof window !== 'undefined' && !window.confirm(t.confirmDisconnect)) return;
      setUnlinkingId(id);
      try {
        const res = await fetch(`${API_BASE}/api/connected-accounts/${encodeURIComponent(id)}`, {
          method: 'DELETE',
          credentials: 'include',
        });
        if (!res.ok && res.status !== 204) {
          throw new Error(`HTTP ${res.status}`);
        }
        await refresh();
      } catch (err) {
        setFlash({
          kind: 'err',
          text: err instanceof Error ? err.message : 'Network error',
        });
      } finally {
        setUnlinkingId(null);
      }
    },
    [refresh, t.confirmDisconnect]
  );

  return (
    <div className="space-y-3">
      <p className="text-[11px] text-[var(--text-muted)]">{t.hint}</p>

      {flash && (
        <div
          className={`flex items-start gap-2 rounded border px-3 py-2 text-xs ${
            flash.kind === 'ok'
              ? 'border-emerald-500/40 bg-emerald-500/5 text-emerald-300'
              : 'border-rose-500/40 bg-rose-500/5 text-rose-300'
          }`}
        >
          {flash.kind === 'ok' ? (
            <Check size={14} className="mt-0.5 shrink-0" />
          ) : (
            <ShieldAlert size={14} className="mt-0.5 shrink-0" />
          )}
          <span>{flash.text}</span>
        </div>
      )}

      <div className="flex flex-wrap items-start gap-2">
        <button
          type="button"
          onClick={handleConnectGithub}
          disabled={linking}
          className="flex items-center gap-2 rounded-md border border-[var(--panel-border)] bg-[var(--panel-bg)] px-3 py-2 text-sm text-[var(--text-primary)] transition-colors hover:border-[var(--accent-color)] disabled:opacity-50"
        >
          {linking ? <Loader2 size={14} className="animate-spin" /> : <Github size={14} />}
          {linking ? t.connecting : t.connectGithub}
        </button>
        <AddCredentialForm lang={lang} onSaved={() => void refresh()} />
      </div>

      {accounts === null && error === null ? (
        <div className="text-xs text-[var(--text-muted)]">…</div>
      ) : error ? (
        <div className="text-xs text-rose-400">{error}</div>
      ) : accounts && accounts.length === 0 ? (
        <div className="text-xs text-[var(--text-muted)]">{t.empty}</div>
      ) : (
        <ul className="divide-y divide-[var(--panel-border)] rounded-md border border-[var(--panel-border)]">
          {accounts!.map(acc => (
            <li key={acc.id} className="flex items-center justify-between px-3 py-2 text-sm">
              <div className="min-w-0">
                <div className="flex items-center gap-2 text-[var(--text-primary)]">
                  {acc.provider === 'github' ? (
                    <Github size={13} />
                  ) : acc.provider.startsWith('ai.') ? (
                    <Sparkles size={13} />
                  ) : (
                    <KeyRound size={13} />
                  )}
                  <span className="truncate">{acc.displayName ?? acc.id}</span>
                  <span className="font-mono text-[10px] text-[var(--text-muted)]">
                    {acc.provider}
                  </span>
                </div>
                <div className="mt-0.5 truncate text-[10px] text-[var(--text-muted)]">
                  {acc.provider.startsWith('ai.')
                    ? [acc.metadata?.defaultModel, acc.metadata?.baseUrl]
                        .filter(Boolean)
                        .join(' · ') || '—'
                    : `${t.scopes}: ${acc.scopes.join(', ') || '—'}`}
                </div>
              </div>
              <button
                type="button"
                onClick={() => handleDisconnect(acc.id)}
                disabled={unlinkingId === acc.id}
                className="flex shrink-0 items-center gap-1 rounded border border-rose-500/40 px-2 py-1 text-[11px] text-rose-300 transition-colors hover:border-rose-400 hover:text-rose-200 disabled:opacity-50"
              >
                {unlinkingId === acc.id ? (
                  <Loader2 size={11} className="animate-spin" />
                ) : (
                  <Link2Off size={11} />
                )}
                {unlinkingId === acc.id ? t.disconnecting : t.disconnect}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
