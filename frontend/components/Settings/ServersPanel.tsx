'use client';

import { CheckCircle2, KeyRound, Loader2, Plus, ShieldAlert, Trash2, XCircle } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';

import { useAuth } from '@/lib/auth';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

interface ServerRow {
  id: string;
  name: string;
  host: string;
  port: number;
  username: string;
  hostKeyFingerprint: string;
  authMode: 'key' | 'certificate';
  credentialId: string | null;
  sudoAllowed: boolean;
  lastCheckedAt: string | null;
  lastCheckError: string | null;
}

interface SshAccount {
  id: string;
  displayName: string | null;
  provider: string;
}

const STRINGS = {
  en: {
    empty: 'No servers yet. SSH steps can only reach servers registered here.',
    add: 'Add server',
    cancel: 'Cancel',
    host: 'Host',
    port: 'Port',
    scan: 'Read host key',
    scanning: 'Reading…',
    verify:
      'Check this fingerprint on the server before saving (ssh-keygen -lf /etc/ssh/ssh_host_ed25519_key.pub). It is pinned: if the server ever presents another key, steps refuse to connect.',
    name: 'Name',
    user: 'User',
    auth: 'Authentication',
    authKey: 'Private key (connected account)',
    authCert: 'Short-lived certificate (workspace CA)',
    credential: 'SSH key',
    noKeys: 'No SSH keys yet. Add one in Connected accounts with provider "ssh".',
    sudo: 'Allow privileged steps (sudo -n, after approval)',
    save: 'Register server',
    saving: 'Saving…',
    check: 'Test connection',
    remove: 'Remove',
    confirmRemove: (n: string) => `Remove ${n}? Runbooks using it will stop working.`,
    ok: 'Connected',
    never: 'Not tested yet',
    sudoOk: 'sudo works',
    sudoNo: 'sudo refused',
    ca: 'Workspace SSH CA',
    caHint:
      'Servers in certificate mode trust this key. Each step gets a fresh certificate valid for 5 minutes for the server user.',
    showCa: 'Show CA and sshd setup',
    adminOnly: 'Only admins can add or change servers.',
    failed: 'Request failed',
  },
  es: {
    empty: 'Todavía no hay servidores. Los pasos SSH solo llegan a los servidores registrados acá.',
    add: 'Agregar servidor',
    cancel: 'Cancelar',
    host: 'Host',
    port: 'Puerto',
    scan: 'Leer clave del host',
    scanning: 'Leyendo…',
    verify:
      'Verificá esta huella en el servidor antes de guardar (ssh-keygen -lf /etc/ssh/ssh_host_ed25519_key.pub). Queda fijada: si el servidor alguna vez presenta otra clave, los pasos se niegan a conectar.',
    name: 'Nombre',
    user: 'Usuario',
    auth: 'Autenticación',
    authKey: 'Clave privada (cuenta conectada)',
    authCert: 'Certificado de corta vida (CA del workspace)',
    credential: 'Clave SSH',
    noKeys: 'Todavía no hay claves SSH. Agregá una en Cuentas conectadas con proveedor "ssh".',
    sudo: 'Permitir pasos privilegiados (sudo -n, con aprobación)',
    save: 'Registrar servidor',
    saving: 'Guardando…',
    check: 'Probar conexión',
    remove: 'Eliminar',
    confirmRemove: (n: string) =>
      `¿Eliminar ${n}? Los runbooks que lo usan van a dejar de funcionar.`,
    ok: 'Conectó',
    never: 'Sin probar',
    sudoOk: 'sudo funciona',
    sudoNo: 'sudo rechazado',
    ca: 'CA SSH del workspace',
    caHint:
      'Los servidores en modo certificado confían en esta clave. Cada paso recibe un certificado nuevo, válido 5 minutos, para el usuario del servidor.',
    showCa: 'Mostrar CA y configuración de sshd',
    adminOnly: 'Solo los admins pueden agregar o cambiar servidores.',
    failed: 'Falló la operación',
  },
} as const;

async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    credentials: 'include',
    ...init,
    headers: { 'Content-Type': 'application/json', ...(init?.headers ?? {}) },
  });
  if (res.status === 204) return undefined as T;
  const body = (await res.json().catch(() => ({}))) as { data?: T; error?: string };
  if (!res.ok) throw new Error(body.error ?? `HTTP ${res.status}`);
  return body.data as T;
}

const inputClass =
  'w-full rounded border border-[var(--input-border)] bg-[var(--input-bg)] px-2 py-1.5 text-xs text-[var(--text-primary)] focus:border-primary focus:outline-none';
const buttonClass =
  'inline-flex items-center gap-1.5 rounded border border-[var(--panel-border)] px-2.5 py-1 text-xs text-[var(--text-primary)] hover:bg-white/5 disabled:opacity-50';

export function ServersPanel({ lang }: { lang: 'en' | 'es' }) {
  const t = STRINGS[lang];
  const { session } = useAuth();
  const isAdmin = session?.user.role === 'ADMIN';
  const [servers, setServers] = useState<ServerRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [checking, setChecking] = useState<string | null>(null);
  const [checks, setChecks] = useState<Record<string, { ok: boolean; sudo: boolean | null }>>({});
  const [ca, setCa] = useState<{ publicKey: string; setup: string } | null>(null);

  const load = useCallback(async () => {
    try {
      setServers(await api<ServerRow[]>('/api/servers'));
    } catch (err) {
      setError((err as Error).message);
      setServers([]);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function check(id: string) {
    setChecking(id);
    setError(null);
    try {
      const r = await api<{ ok: boolean; error: string | null; sudo: boolean | null }>(
        `/api/servers/${id}/check`,
        { method: 'POST' }
      );
      setChecks(c => ({ ...c, [id]: { ok: r.ok, sudo: r.sudo } }));
      await load();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setChecking(null);
    }
  }

  async function remove(server: ServerRow) {
    if (!window.confirm(t.confirmRemove(server.name))) return;
    try {
      await api(`/api/servers/${server.id}`, { method: 'DELETE' });
      await load();
    } catch (err) {
      setError((err as Error).message);
    }
  }

  async function showCa() {
    try {
      setCa(await api<{ publicKey: string; setup: string }>('/api/servers/ca'));
    } catch (err) {
      setError((err as Error).message);
    }
  }

  if (servers === null) {
    return <Loader2 className="h-4 w-4 animate-spin text-[var(--text-muted)]" />;
  }

  return (
    <div className="space-y-3">
      {servers.length === 0 && <p className="text-xs text-[var(--text-muted)]">{t.empty}</p>}
      {servers.map(s => {
        const result = checks[s.id];
        return (
          <div
            key={s.id}
            className="flex flex-wrap items-start justify-between gap-3 rounded border border-[var(--panel-border)] px-3 py-2"
          >
            <div className="min-w-0">
              <div className="text-sm font-medium text-[var(--text-primary)]">{s.name}</div>
              <div className="font-mono text-[11px] text-[var(--text-muted)]">
                {s.username}@{s.host}
                {s.port !== 22 ? `:${s.port}` : ''} · {s.hostKeyFingerprint}
              </div>
              <div className="mt-1 flex flex-wrap gap-x-3 text-[11px] text-[var(--text-muted)]">
                <span>{s.authMode === 'certificate' ? t.authCert : t.authKey}</span>
                {s.sudoAllowed && <span>sudo</span>}
                {s.lastCheckedAt && !s.lastCheckError && (
                  <span className="inline-flex items-center gap-1 text-emerald-400">
                    <CheckCircle2 size={11} /> {t.ok}
                    {result?.sudo === true && ` · ${t.sudoOk}`}
                    {result?.sudo === false && ` · ${t.sudoNo}`}
                  </span>
                )}
                {s.lastCheckError && (
                  <span className="inline-flex items-center gap-1 text-red-400">
                    <XCircle size={11} /> {s.lastCheckError}
                  </span>
                )}
                {!s.lastCheckedAt && <span>{t.never}</span>}
              </div>
            </div>
            {isAdmin && (
              <div className="flex gap-1.5">
                <button
                  type="button"
                  className={buttonClass}
                  onClick={() => void check(s.id)}
                  disabled={checking === s.id}
                >
                  {checking === s.id && <Loader2 size={12} className="animate-spin" />}
                  {t.check}
                </button>
                <button
                  type="button"
                  className={buttonClass}
                  onClick={() => void remove(s)}
                  aria-label={t.remove}
                  title={t.remove}
                >
                  <Trash2 size={12} />
                </button>
              </div>
            )}
          </div>
        );
      })}

      {error && <p className="text-xs text-red-400">{`${t.failed}: ${error}`}</p>}

      {!isAdmin && <p className="text-[11px] text-[var(--text-muted)]">{t.adminOnly}</p>}

      {isAdmin &&
        (adding ? (
          <AddServerForm
            lang={lang}
            onDone={async () => {
              setAdding(false);
              await load();
            }}
            onCancel={() => setAdding(false)}
          />
        ) : (
          <button type="button" className={buttonClass} onClick={() => setAdding(true)}>
            <Plus size={12} /> {t.add}
          </button>
        ))}

      {isAdmin && (
        <div className="border-t border-[var(--panel-border)] pt-3">
          <div className="mb-1 flex items-center gap-1.5 text-xs font-medium text-[var(--text-primary)]">
            <KeyRound size={12} /> {t.ca}
          </div>
          <p className="mb-2 text-[11px] text-[var(--text-muted)]">{t.caHint}</p>
          {ca ? (
            <pre className="overflow-x-auto whitespace-pre-wrap break-all rounded bg-black/30 p-2 font-mono text-[11px] text-[var(--text-primary)]">
              {ca.setup}
            </pre>
          ) : (
            <button type="button" className={buttonClass} onClick={() => void showCa()}>
              {t.showCa}
            </button>
          )}
        </div>
      )}
    </div>
  );
}

function AddServerForm({
  lang,
  onDone,
  onCancel,
}: {
  lang: 'en' | 'es';
  onDone: () => void;
  onCancel: () => void;
}) {
  const t = STRINGS[lang];
  const [host, setHost] = useState('');
  const [port, setPort] = useState(22);
  const [scan, setScan] = useState<{ hostKey: string; fingerprint: string; type: string } | null>(
    null
  );
  const [scanning, setScanning] = useState(false);
  const [name, setName] = useState('');
  const [username, setUsername] = useState('deploy');
  const [authMode, setAuthMode] = useState<'key' | 'certificate'>('key');
  const [credentialId, setCredentialId] = useState('');
  const [sudoAllowed, setSudoAllowed] = useState(false);
  const [keys, setKeys] = useState<SshAccount[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api<SshAccount[]>('/api/connected-accounts?provider=ssh')
      .then(list => setKeys(list ?? []))
      .catch(() => setKeys([]));
  }, []);

  async function readKey() {
    setScanning(true);
    setError(null);
    setScan(null);
    try {
      setScan(
        await api<{ hostKey: string; fingerprint: string; type: string }>('/api/servers/scan', {
          method: 'POST',
          body: JSON.stringify({ host: host.trim(), port }),
        })
      );
      if (!name) setName(host.trim().split('.')[0]);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setScanning(false);
    }
  }

  async function save() {
    if (!scan) return;
    setSaving(true);
    setError(null);
    try {
      await api('/api/servers', {
        method: 'POST',
        body: JSON.stringify({
          name: name.trim(),
          host: host.trim(),
          port,
          username: username.trim(),
          hostKey: scan.hostKey,
          authMode,
          credentialId: authMode === 'key' ? credentialId || null : null,
          sudoAllowed,
        }),
      });
      onDone();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-3 rounded border border-[var(--panel-border)] p-3">
      <div className="grid grid-cols-[1fr_80px_auto] items-end gap-2">
        <label className="text-[11px] text-[var(--text-muted)]">
          {t.host}
          <input
            className={inputClass}
            value={host}
            onChange={e => {
              setHost(e.target.value);
              setScan(null);
            }}
            placeholder="prod-1.example.com"
          />
        </label>
        <label className="text-[11px] text-[var(--text-muted)]">
          {t.port}
          <input
            className={inputClass}
            type="number"
            value={port}
            onChange={e => {
              setPort(Number(e.target.value) || 22);
              setScan(null);
            }}
          />
        </label>
        <button
          type="button"
          className={buttonClass}
          disabled={!host.trim() || scanning}
          onClick={() => void readKey()}
        >
          {scanning && <Loader2 size={12} className="animate-spin" />}
          {scanning ? t.scanning : t.scan}
        </button>
      </div>

      {scan && (
        <>
          <div className="rounded border border-amber-500/40 bg-amber-500/10 p-2 text-[11px] text-[var(--text-primary)]">
            <div className="mb-1 flex items-center gap-1.5 font-mono">
              <ShieldAlert size={12} className="text-amber-400" />
              {scan.type} {scan.fingerprint}
            </div>
            <p className="text-[var(--text-muted)]">{t.verify}</p>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <label className="text-[11px] text-[var(--text-muted)]">
              {t.name}
              <input className={inputClass} value={name} onChange={e => setName(e.target.value)} />
            </label>
            <label className="text-[11px] text-[var(--text-muted)]">
              {t.user}
              <input
                className={inputClass}
                value={username}
                onChange={e => setUsername(e.target.value)}
              />
            </label>
          </div>
          <fieldset className="space-y-1 text-xs text-[var(--text-primary)]">
            <legend className="text-[11px] text-[var(--text-muted)]">{t.auth}</legend>
            <label className="flex items-center gap-2">
              <input
                type="radio"
                checked={authMode === 'key'}
                onChange={() => setAuthMode('key')}
              />
              {t.authKey}
            </label>
            <label className="flex items-center gap-2">
              <input
                type="radio"
                checked={authMode === 'certificate'}
                onChange={() => setAuthMode('certificate')}
              />
              {t.authCert}
            </label>
          </fieldset>
          {authMode === 'key' &&
            (keys.length === 0 ? (
              <p className="text-[11px] text-amber-400">{t.noKeys}</p>
            ) : (
              <label className="block text-[11px] text-[var(--text-muted)]">
                {t.credential}
                <select
                  className={inputClass}
                  value={credentialId}
                  onChange={e => setCredentialId(e.target.value)}
                >
                  <option value="">—</option>
                  {keys.map(k => (
                    <option key={k.id} value={k.id}>
                      {k.displayName ?? k.id}
                    </option>
                  ))}
                </select>
              </label>
            ))}
          <label className="flex items-center gap-2 text-xs text-[var(--text-primary)]">
            <input
              type="checkbox"
              checked={sudoAllowed}
              onChange={e => setSudoAllowed(e.target.checked)}
            />
            {t.sudo}
          </label>
        </>
      )}

      {error && <p className="text-xs text-red-400">{error}</p>}

      <div className="flex gap-2">
        <button
          type="button"
          className={buttonClass}
          disabled={
            !scan ||
            saving ||
            !name.trim() ||
            !username.trim() ||
            (authMode === 'key' && !credentialId)
          }
          onClick={() => void save()}
        >
          {saving && <Loader2 size={12} className="animate-spin" />}
          {saving ? t.saving : t.save}
        </button>
        <button type="button" className={buttonClass} onClick={onCancel}>
          {t.cancel}
        </button>
      </div>
    </div>
  );
}
