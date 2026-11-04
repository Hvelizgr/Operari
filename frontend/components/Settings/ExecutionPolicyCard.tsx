'use client';

import { Loader2 } from 'lucide-react';
import { useEffect, useState } from 'react';

import { useAuth } from '@/lib/auth';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

interface Policy {
  sshPolicy: 'registered' | 'any';
  sandboxEgress: 'open' | 'allowlist' | 'none';
  egressAllowlist: string[];
  privilegedApprovals: 1 | 2;
}

const STRINGS = {
  en: {
    ssh: 'SSH targets',
    sshRegistered: 'Registered servers only (host key pinned)',
    sshAny: 'Also ad-hoc hosts typed in the step (no host key check)',
    egress: 'Sandbox internet access',
    egressHint:
      'Applies to the terminal and to shell steps set to "Internet". Private networks and the Operari host are never reachable.',
    open: 'Open internet',
    allowlist: 'Only these hosts',
    none: 'No network',
    hosts: 'One host per line; *.example.com matches subdomains.',
    approvals: 'Approvals before a sudo step',
    one: '1 approver',
    two: '2 different approvers',
    save: 'Save policy',
    saving: 'Saving…',
    saved: 'Saved',
    readonly: 'Only admins can change this.',
    failed: 'Could not save',
  },
  es: {
    ssh: 'Destinos SSH',
    sshRegistered: 'Solo servidores registrados (clave del host fijada)',
    sshAny: 'También hosts ad-hoc escritos en el paso (sin verificar la clave del host)',
    egress: 'Acceso a internet del sandbox',
    egressHint:
      'Aplica a la terminal y a los pasos shell con red "Internet". Las redes privadas y el host de Operari nunca son alcanzables.',
    open: 'Internet abierta',
    allowlist: 'Solo estos hosts',
    none: 'Sin red',
    hosts: 'Un host por línea; *.example.com incluye subdominios.',
    approvals: 'Aprobaciones antes de un paso con sudo',
    one: '1 aprobador',
    two: '2 aprobadores distintos',
    save: 'Guardar política',
    saving: 'Guardando…',
    saved: 'Guardado',
    readonly: 'Solo los admins pueden cambiarla.',
    failed: 'No se pudo guardar',
  },
} as const;

export function ExecutionPolicyCard({ lang }: { lang: 'en' | 'es' }) {
  const t = STRINGS[lang];
  const { session } = useAuth();
  const isAdmin = session?.user.role === 'ADMIN';
  const [policy, setPolicy] = useState<Policy | null>(null);
  const [hostsText, setHostsText] = useState('');
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<string | null>(null);

  useEffect(() => {
    fetch(`${API_BASE}/api/tenants/execution-policy`, { credentials: 'include' })
      .then(r => (r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`))))
      .then((json: { data: Policy }) => {
        setPolicy(json.data);
        setHostsText(json.data.egressAllowlist.join('\n'));
      })
      .catch(() => setStatus(t.failed));
  }, [t.failed]);

  if (!policy) {
    return status ? (
      <p className="text-xs text-red-400">{status}</p>
    ) : (
      <Loader2 className="h-4 w-4 animate-spin text-[var(--text-muted)]" />
    );
  }

  const set = <K extends keyof Policy>(key: K, value: Policy[K]) => {
    setPolicy({ ...policy, [key]: value });
    setStatus(null);
  };

  async function save() {
    if (!policy) return;
    setSaving(true);
    setStatus(null);
    const egressAllowlist = hostsText
      .split(/[\s,]+/)
      .map(h => h.trim())
      .filter(Boolean);
    try {
      const res = await fetch(`${API_BASE}/api/tenants/execution-policy`, {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...policy, egressAllowlist }),
      });
      const body = (await res.json().catch(() => ({}))) as { data?: Policy; error?: string };
      if (!res.ok || !body.data) throw new Error(body.error ?? `HTTP ${res.status}`);
      setPolicy(body.data);
      setHostsText(body.data.egressAllowlist.join('\n'));
      setStatus(t.saved);
    } catch (err) {
      setStatus(`${t.failed}: ${(err as Error).message}`);
    } finally {
      setSaving(false);
    }
  }

  const radio = (name: string, checked: boolean, onChange: () => void, label: string) => (
    <label className="flex items-center gap-2 text-xs text-[var(--text-primary)]">
      <input type="radio" name={name} checked={checked} onChange={onChange} disabled={!isAdmin} />
      {label}
    </label>
  );

  return (
    <div className="space-y-4">
      <fieldset className="space-y-1">
        <legend className="mb-1 text-[11px] font-medium text-[var(--text-muted)]">{t.ssh}</legend>
        {radio(
          'ssh',
          policy.sshPolicy === 'registered',
          () => set('sshPolicy', 'registered'),
          t.sshRegistered
        )}
        {radio('ssh', policy.sshPolicy === 'any', () => set('sshPolicy', 'any'), t.sshAny)}
      </fieldset>

      <fieldset className="space-y-1">
        <legend className="mb-1 text-[11px] font-medium text-[var(--text-muted)]">
          {t.egress}
        </legend>
        <p className="mb-1 text-[11px] text-[var(--text-muted)]">{t.egressHint}</p>
        {radio(
          'egress',
          policy.sandboxEgress === 'open',
          () => set('sandboxEgress', 'open'),
          t.open
        )}
        {radio(
          'egress',
          policy.sandboxEgress === 'allowlist',
          () => set('sandboxEgress', 'allowlist'),
          t.allowlist
        )}
        {policy.sandboxEgress === 'allowlist' && (
          <div className="pl-5">
            <textarea
              className="focus:border-primary w-full rounded border border-[var(--input-border)] bg-[var(--input-bg)] px-2 py-1.5 font-mono text-xs text-[var(--text-primary)] focus:outline-none"
              rows={5}
              value={hostsText}
              onChange={e => {
                setHostsText(e.target.value);
                setStatus(null);
              }}
              placeholder={'pypi.org\nfiles.pythonhosted.org\n*.github.com'}
              disabled={!isAdmin}
            />
            <p className="text-[11px] text-[var(--text-muted)]">{t.hosts}</p>
          </div>
        )}
        {radio(
          'egress',
          policy.sandboxEgress === 'none',
          () => set('sandboxEgress', 'none'),
          t.none
        )}
      </fieldset>

      <fieldset className="space-y-1">
        <legend className="mb-1 text-[11px] font-medium text-[var(--text-muted)]">
          {t.approvals}
        </legend>
        {radio(
          'approvals',
          policy.privilegedApprovals === 1,
          () => set('privilegedApprovals', 1),
          t.one
        )}
        {radio(
          'approvals',
          policy.privilegedApprovals === 2,
          () => set('privilegedApprovals', 2),
          t.two
        )}
      </fieldset>

      {isAdmin ? (
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => void save()}
            disabled={saving}
            className="inline-flex items-center gap-1.5 rounded border border-[var(--panel-border)] px-2.5 py-1 text-xs text-[var(--text-primary)] hover:bg-white/5 disabled:opacity-50"
          >
            {saving && <Loader2 size={12} className="animate-spin" />}
            {saving ? t.saving : t.save}
          </button>
          {status && <span className="text-[11px] text-[var(--text-muted)]">{status}</span>}
        </div>
      ) : (
        <p className="text-[11px] text-[var(--text-muted)]">{t.readonly}</p>
      )}
    </div>
  );
}
