'use client';

import {
  type ColumnDef,
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  type SortingState,
  useReactTable,
} from '@tanstack/react-table';
import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  Check,
  CircleSlash2,
  Github,
  Link2Off,
  Loader2,
  Pencil,
  ShieldAlert,
  Wifi,
  X,
} from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { formatDateTime } from '@/lib/datetime';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

interface ConnectedAccount {
  id: string;
  provider: string;
  displayName: string | null;
  scopes: string[];
  createdAt: string;
  env?: string | null;
}

// Same shape the backend enforces — keep client-side validation in
// sync so we never POST a value the API will reject.
const ENV_RE = /^[a-z0-9][a-z0-9_-]{0,31}$/i;
const ENV_SUGGESTIONS = ['prod', 'staging', 'dev', 'test', 'preview'];

const STRINGS = {
  en: {
    title: 'Connected accounts',
    hint: 'Link a GitHub account so the runbook engine can post commit statuses, write files, and read repo metadata. Each connected account is encrypted at rest and every read emits a `secret.accessed` audit event.',
    connectGithub: 'Connect GitHub',
    connecting: 'Connecting…',
    empty: 'No accounts linked yet.',
    disconnect: 'Disconnect',
    disconnecting: 'Disconnecting…',
    confirmDisconnect:
      'Disconnect this GitHub account? Runbooks that reference it will start failing on the next run.',
    linkedFlash: 'GitHub account linked.',
    errorFlash: 'Could not link GitHub account.',
    scopes: 'Scopes',
    provider: 'Provider',
    name: 'Name',
    linkedAt: 'Linked',
    actions: 'Actions',
    env: 'Environment',
    envHint:
      'Tag this account with the environment it points at (prod / staging / dev). Edges on the runbook canvas that cross environments get a warning chip — useful for catching prod-after-staging fanouts at author time.',
    envEdit: 'Set environment',
    envClear: 'Clear',
    envSave: 'Save',
    envCancel: 'Cancel',
    envInvalid: 'Use a-z, 0-9, dash or underscore (max 32 chars)',
    test: 'Test',
    testing: 'Testing…',
    testOk: 'Token works',
    testFail: 'Token rejected',
    testUnsupported: 'No test for this provider',
  },
  es: {
    title: 'Cuentas conectadas',
    hint: 'Vinculá una cuenta de GitHub para que el motor de runbooks pueda postear commit statuses, escribir archivos y leer metadata del repo. Cada cuenta vinculada se encripta en reposo y cada lectura emite un evento de auditoría `secret.accessed`.',
    connectGithub: 'Conectar GitHub',
    connecting: 'Conectando…',
    empty: 'No hay cuentas vinculadas todavía.',
    disconnect: 'Desconectar',
    disconnecting: 'Desconectando…',
    confirmDisconnect:
      '¿Desconectar esta cuenta de GitHub? Los runbooks que la referencian van a empezar a fallar en la próxima corrida.',
    linkedFlash: 'Cuenta de GitHub vinculada.',
    errorFlash: 'No se pudo vincular la cuenta de GitHub.',
    scopes: 'Permisos',
    provider: 'Proveedor',
    name: 'Nombre',
    linkedAt: 'Vinculado',
    actions: 'Acciones',
    env: 'Entorno',
    envHint:
      'Etiquetá esta cuenta con el entorno al que apunta (prod / staging / dev). Las conexiones en el canvas que cruzan entornos muestran un chip de advertencia — útil para detectar fanouts prod-después-de-staging al diseñar el runbook.',
    envEdit: 'Asignar entorno',
    envClear: 'Limpiar',
    envSave: 'Guardar',
    envCancel: 'Cancelar',
    envInvalid: 'Usá a-z, 0-9, guión o guión bajo (máx 32 chars)',
    test: 'Probar',
    testing: 'Probando…',
    testOk: 'Token funciona',
    testFail: 'Token rechazado',
    testUnsupported: 'Sin prueba para este proveedor',
  },
} as const;

interface Props {
  lang: 'en' | 'es';
}

type Strings = (typeof STRINGS)[keyof typeof STRINGS];

interface EnvCellProps {
  account: ConnectedAccount;
  t: Strings;
  onSave: (id: string, env: string | null) => Promise<void>;
}

/**
 * Inline editor for `metadata.env`. Read-mode shows the current tag
 * (or a "—" affordance to add one); edit-mode swaps in an input
 * with a datalist of common env names. Enter / blur saves; Escape
 * cancels. Validates client-side against the same regex the backend
 * enforces so an invalid value never round-trips.
 */
function EnvCell({ account, t, onSave }: EnvCellProps) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(account.env ?? '');
  const [saving, setSaving] = useState(false);
  const [localErr, setLocalErr] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  // Reset when the underlying value changes (e.g. after refresh).
  useEffect(() => {
    if (!editing) setDraft(account.env ?? '');
  }, [account.env, editing]);

  // Autofocus when entering edit mode so the operator can type
  // immediately without an extra click.
  useEffect(() => {
    if (editing) inputRef.current?.focus();
  }, [editing]);

  const handleSave = useCallback(async () => {
    const trimmed = draft.trim();
    if (trimmed && !ENV_RE.test(trimmed)) {
      setLocalErr(t.envInvalid);
      return;
    }
    setSaving(true);
    setLocalErr(null);
    try {
      await onSave(account.id, trimmed === '' ? null : trimmed);
      setEditing(false);
    } catch (err) {
      setLocalErr(err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(false);
    }
  }, [account.id, draft, onSave, t.envInvalid]);

  if (!editing) {
    return (
      <button
        type="button"
        onClick={() => {
          setDraft(account.env ?? '');
          setEditing(true);
        }}
        className="group inline-flex items-center gap-1.5 rounded border border-transparent px-1.5 py-0.5 text-[11px] transition-colors hover:border-[var(--panel-border)]"
        title={t.envEdit}
      >
        {account.env ? (
          <span className="font-mono uppercase text-[var(--text-primary)]">{account.env}</span>
        ) : (
          <span className="text-[var(--text-muted)]">—</span>
        )}
        <Pencil
          size={10}
          className="opacity-0 transition-opacity group-hover:opacity-60"
          aria-hidden
        />
      </button>
    );
  }

  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center gap-1">
        <input
          ref={inputRef}
          list={`env-suggestions-${account.id}`}
          value={draft}
          onChange={e => {
            setDraft(e.target.value);
            if (localErr) setLocalErr(null);
          }}
          onKeyDown={e => {
            if (e.key === 'Enter') {
              e.preventDefault();
              void handleSave();
            } else if (e.key === 'Escape') {
              e.preventDefault();
              setEditing(false);
              setDraft(account.env ?? '');
              setLocalErr(null);
            }
          }}
          disabled={saving}
          aria-label={t.env}
          className="w-24 rounded border border-[var(--panel-border)] bg-[var(--panel-bg)] px-1.5 py-0.5 font-mono text-[11px] uppercase text-[var(--text-primary)] outline-none focus:border-[var(--accent-color)] disabled:opacity-50"
          placeholder="prod"
        />
        <datalist id={`env-suggestions-${account.id}`}>
          {ENV_SUGGESTIONS.map(s => (
            <option key={s} value={s} />
          ))}
        </datalist>
        <button
          type="button"
          onClick={() => void handleSave()}
          disabled={saving}
          aria-label={t.envSave}
          className="rounded p-1 text-emerald-300 hover:text-emerald-200 disabled:opacity-50"
        >
          {saving ? <Loader2 size={11} className="animate-spin" /> : <Check size={11} />}
        </button>
        <button
          type="button"
          onClick={() => {
            setEditing(false);
            setDraft(account.env ?? '');
            setLocalErr(null);
          }}
          disabled={saving}
          aria-label={t.envCancel}
          className="rounded p-1 text-[var(--text-muted)] hover:text-[var(--text-primary)] disabled:opacity-50"
        >
          <X size={11} />
        </button>
      </div>
      {localErr && <span className="text-[10px] text-rose-400">{localErr}</span>}
    </div>
  );
}

export default function ConnectedAccountsPanel({ lang }: Props) {
  const t = STRINGS[lang] ?? STRINGS.en;
  const [accounts, setAccounts] = useState<ConnectedAccount[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [linking, setLinking] = useState(false);
  const [unlinkingId, setUnlinkingId] = useState<string | null>(null);
  const [flash, setFlash] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null);
  const [testingId, setTestingId] = useState<string | null>(null);
  const [testResults, setTestResults] = useState<
    Record<string, { ok: boolean; text: string } | undefined>
  >({});

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

  const handleUpdateEnv = useCallback(
    async (id: string, env: string | null) => {
      const res = await fetch(`${API_BASE}/api/connected-accounts/${encodeURIComponent(id)}`, {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ env }),
      });
      if (!res.ok) {
        let msg = `HTTP ${res.status}`;
        try {
          const body = (await res.json()) as { error?: string };
          if (body.error) msg = body.error;
        } catch {
          // intentional — fall back to the HTTP status
        }
        throw new Error(msg);
      }
      // Optimistic-style refresh: re-fetch the list so the cell
      // reflects exactly what the server stored. Cheap (<50 rows).
      await refresh();
    },
    [refresh]
  );

  const handleTest = useCallback(
    async (id: string) => {
      setTestingId(id);
      try {
        const res = await fetch(
          `${API_BASE}/api/connected-accounts/${encodeURIComponent(id)}/test`,
          {
            method: 'POST',
            credentials: 'include',
          }
        );
        // 501 = provider unsupported. Surface that as a distinct
        // outcome (gray icon) — it's neither a token failure nor
        // a success.
        if (res.status === 501) {
          setTestResults(prev => ({ ...prev, [id]: { ok: false, text: t.testUnsupported } }));
          return;
        }
        const body = (await res.json().catch(() => ({}))) as {
          success?: boolean;
          info?: { login?: string | null; scopes?: string[] };
          message?: string;
        };
        if (!res.ok) {
          setTestResults(prev => ({
            ...prev,
            [id]: { ok: false, text: body.message ?? `HTTP ${res.status}` },
          }));
          return;
        }
        if (body.success === true) {
          const login = body.info?.login ? `@${body.info.login}` : '';
          const scopes =
            body.info?.scopes && body.info.scopes.length > 0
              ? ` · ${body.info.scopes.slice(0, 3).join(', ')}${body.info.scopes.length > 3 ? '…' : ''}`
              : '';
          setTestResults(prev => ({
            ...prev,
            [id]: { ok: true, text: `${t.testOk}${login ? ` (${login}${scopes})` : ''}` },
          }));
        } else {
          setTestResults(prev => ({
            ...prev,
            [id]: { ok: false, text: `${t.testFail}: ${body.message ?? '?'}` },
          }));
        }
      } catch (err) {
        setTestResults(prev => ({
          ...prev,
          [id]: { ok: false, text: err instanceof Error ? err.message : String(err) },
        }));
      } finally {
        setTestingId(null);
      }
    },
    [t.testOk, t.testFail, t.testUnsupported]
  );

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

  // react-table column model. Sorting is client-side over the full
  // accounts list (typically <50 rows per tenant) so we don't need a
  // server-side sort param. The "Actions" column opts out of sort —
  // sorting buttons by their own UI doesn't make sense.
  const columns = useMemo<ColumnDef<ConnectedAccount>[]>(
    () => [
      {
        accessorKey: 'provider',
        header: t.provider,
        cell: info => {
          const provider = info.getValue<string>();
          return provider === 'github' ? (
            <span className="inline-flex items-center gap-1.5 text-[var(--text-primary)]">
              <Github size={13} />
              <span className="font-mono text-[10px] uppercase">{provider}</span>
            </span>
          ) : (
            <span className="font-mono text-[10px] uppercase text-[var(--text-primary)]">
              {provider}
            </span>
          );
        },
      },
      {
        id: 'name',
        header: t.name,
        accessorFn: row => row.displayName ?? row.id,
        cell: info => {
          const acc = info.row.original;
          return (
            <div className="min-w-0">
              <div className="truncate text-[var(--text-primary)]">{acc.displayName ?? acc.id}</div>
              <div className="mt-0.5 truncate text-[10px] text-[var(--text-muted)]">
                {t.scopes}: {acc.scopes.join(', ') || '—'}
              </div>
            </div>
          );
        },
      },
      {
        id: 'env',
        header: t.env,
        accessorFn: row => row.env ?? '',
        cell: info => <EnvCell account={info.row.original} t={t} onSave={handleUpdateEnv} />,
      },
      {
        accessorKey: 'createdAt',
        header: t.linkedAt,
        cell: info => {
          // Defensive: date-fns throws on invalid input. Production
          // payloads always have valid ISO strings but the test
          // fixtures use sentinel values (`'t'`), so we render `—`
          // when the parse would throw rather than crashing the row.
          const raw = info.getValue<string>();
          let display = '—';
          if (raw) {
            const d = new Date(raw);
            if (!Number.isNaN(d.getTime())) display = formatDateTime(d, lang);
          }
          return <span className="text-[11px] text-[var(--text-muted)]">{display}</span>;
        },
      },
      {
        id: 'actions',
        header: t.actions,
        cell: info => {
          const acc = info.row.original;
          const result = testResults[acc.id];
          return (
            <div className="flex flex-col items-start gap-1">
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => handleTest(acc.id)}
                  disabled={testingId === acc.id}
                  className="flex shrink-0 items-center gap-1 rounded border border-sky-500/40 px-2 py-1 text-[11px] text-sky-300 transition-colors hover:border-sky-400 hover:text-sky-200 disabled:opacity-50"
                  aria-label={t.test}
                >
                  {testingId === acc.id ? (
                    <Loader2 size={11} className="animate-spin" />
                  ) : result?.ok === true ? (
                    <Check size={11} className="text-emerald-400" />
                  ) : result?.ok === false ? (
                    <CircleSlash2 size={11} className="text-rose-400" />
                  ) : (
                    <Wifi size={11} />
                  )}
                  {testingId === acc.id ? t.testing : t.test}
                </button>
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
              </div>
              {result ? (
                <span className={`text-[10px] ${result.ok ? 'text-emerald-300' : 'text-rose-300'}`}>
                  {result.text}
                </span>
              ) : null}
            </div>
          );
        },
        enableSorting: false,
      },
    ],
    [lang, t, unlinkingId, handleDisconnect, handleUpdateEnv, handleTest, testingId, testResults]
  );

  const [sorting, setSorting] = useState<SortingState>([]);
  const table = useReactTable({
    data: accounts ?? [],
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });

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

      <button
        type="button"
        onClick={handleConnectGithub}
        disabled={linking}
        className="flex items-center gap-2 rounded-md border border-[var(--panel-border)] bg-[var(--panel-bg)] px-3 py-2 text-sm text-[var(--text-primary)] transition-colors hover:border-[var(--accent-color)] disabled:opacity-50"
      >
        {linking ? <Loader2 size={14} className="animate-spin" /> : <Github size={14} />}
        {linking ? t.connecting : t.connectGithub}
      </button>

      {accounts === null && error === null ? (
        <div className="text-xs text-[var(--text-muted)]">…</div>
      ) : error ? (
        <div className="text-xs text-rose-400">{error}</div>
      ) : accounts && accounts.length === 0 ? (
        <div className="text-xs text-[var(--text-muted)]">{t.empty}</div>
      ) : (
        <div className="overflow-hidden rounded-md border border-[var(--panel-border)]">
          <table className="w-full text-left text-sm">
            <thead className="bg-[var(--weathered,#262626)] text-[10px] uppercase tracking-wider text-[var(--text-muted)]">
              {table.getHeaderGroups().map(headerGroup => (
                <tr key={headerGroup.id}>
                  {headerGroup.headers.map(header => {
                    const sortDir = header.column.getIsSorted();
                    const canSort = header.column.getCanSort();
                    return (
                      <th key={header.id} className="px-3 py-2">
                        {canSort ? (
                          <button
                            type="button"
                            onClick={header.column.getToggleSortingHandler()}
                            className="inline-flex items-center gap-1 transition-colors hover:text-[var(--text-primary)]"
                          >
                            {flexRender(header.column.columnDef.header, header.getContext())}
                            {sortDir === 'asc' ? (
                              <ArrowUp size={10} />
                            ) : sortDir === 'desc' ? (
                              <ArrowDown size={10} />
                            ) : (
                              <ArrowUpDown size={10} className="opacity-50" />
                            )}
                          </button>
                        ) : (
                          flexRender(header.column.columnDef.header, header.getContext())
                        )}
                      </th>
                    );
                  })}
                </tr>
              ))}
            </thead>
            <tbody className="divide-y divide-[var(--panel-border)]">
              {table.getRowModel().rows.map(row => (
                <tr key={row.id}>
                  {row.getVisibleCells().map(cell => (
                    <td key={cell.id} className="px-3 py-2 align-top">
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
