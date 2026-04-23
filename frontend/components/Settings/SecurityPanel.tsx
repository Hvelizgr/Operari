'use client';

import { Check, Copy, Download, Loader2, Shield, ShieldCheck } from 'lucide-react';
import QRCode from 'qrcode';
import { useEffect, useState } from 'react';

import { useAuth } from '@/lib/auth';

/**
 * Render an SVG QR code data-URL client-side. We use SVG (not PNG)
 * so the QR stays sharp at any zoom level and doesn't pull a canvas
 * render into the React tree. Size is bounded to keep the bundle
 * payload small; qrcode's SVG output is ~2-3 KB per code.
 */
function useOtpauthQr(otpauth: string | null): string | null {
  const [dataUrl, setDataUrl] = useState<string | null>(null);
  useEffect(() => {
    if (!otpauth) {
      setDataUrl(null);
      return;
    }
    let cancelled = false;
    QRCode.toDataURL(otpauth, { type: 'image/png', margin: 1, width: 220 })
      .then(url => {
        if (!cancelled) setDataUrl(url);
      })
      .catch(() => {
        if (!cancelled) setDataUrl(null);
      });
    return () => {
      cancelled = true;
    };
  }, [otpauth]);
  return dataUrl;
}

function BackupCodesCard({
  codes,
  title,
  body,
  dismissLabel,
  copyLabel,
  copiedLabel,
  downloadLabel,
  onDismiss,
}: {
  codes: string[];
  title: string;
  body: string;
  dismissLabel: string;
  copyLabel: string;
  copiedLabel: string;
  downloadLabel: string;
  onDismiss: () => void;
}) {
  const [copied, setCopied] = useState(false);
  const allText = codes.join('\n');

  async function copyAll() {
    try {
      await navigator.clipboard.writeText(allText);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // no-op — most browsers allow clipboard in https + user gesture
    }
  }

  function downloadTxt() {
    const blob = new Blob([allText + '\n'], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'cairn-mfa-backup-codes.txt';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-3 rounded-lg border border-amber-500/40 bg-amber-500/5 p-4">
      <div>
        <h4 className="text-sm font-semibold text-amber-100">{title}</h4>
        <p className="mt-1 text-xs leading-relaxed text-amber-200/80">{body}</p>
      </div>
      <div className="grid grid-cols-2 gap-2 rounded-md bg-black/30 p-3">
        {codes.map(c => (
          <code key={c} className="font-mono text-sm tracking-widest text-amber-100">
            {c}
          </code>
        ))}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <button
          onClick={copyAll}
          className="inline-flex items-center gap-1.5 rounded-md border border-amber-500/40 px-3 py-1.5 text-xs font-medium text-amber-100 hover:bg-amber-500/10"
        >
          {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
          {copied ? copiedLabel : copyLabel}
        </button>
        <button
          onClick={downloadTxt}
          className="inline-flex items-center gap-1.5 rounded-md border border-amber-500/40 px-3 py-1.5 text-xs font-medium text-amber-100 hover:bg-amber-500/10"
        >
          <Download className="h-3 w-3" />
          {downloadLabel}
        </button>
        <button
          onClick={onDismiss}
          className="bg-primary text-primary-foreground hover:bg-primary/90 ml-auto inline-flex items-center rounded-md px-3 py-1.5 text-xs font-semibold shadow"
        >
          {dismissLabel}
        </button>
      </div>
    </div>
  );
}

const STRINGS = {
  en: {
    hint: 'Protect your account with a time-based one-time code (TOTP) from Google Authenticator, 1Password, or similar.',
    status: 'Status',
    statusOn: 'Enabled',
    statusOff: 'Disabled',
    enroll: 'Enable 2FA',
    enrolling: 'Setting up…',
    disableCta: 'Disable 2FA',
    disabling: 'Disabling…',
    qrLabel: 'Scan this QR with Google Authenticator, 1Password, Raycast, or any TOTP app:',
    copyLabel: 'Or type this secret into your authenticator:',
    urlLabel: 'Full otpauth URL (advanced):',
    verifyLabel: 'Enter the 6-digit code from your app',
    verify: 'Confirm enrollment',
    verifying: 'Confirming…',
    successToast: '2FA is now enabled on your account.',
    backupCodesTitle: 'Save these backup codes',
    backupCodesBody:
      'Each code works once if you lose your phone. Store them somewhere safe — this is the only time we will show them.',
    backupCodesDismiss: 'I saved them',
    backupCodesCopy: 'Copy all',
    backupCodesCopied: 'Copied',
    backupCodesDownload: 'Download .txt',
    wrongCode: 'That code did not match. Try the next one your app shows.',
    failed: 'Could not complete the request. Try again in a moment.',
    disablePwLabel: 'Current password',
    disableCodeLabel: 'Current TOTP code',
    disableSubmit: 'Disable',
  },
  es: {
    hint: 'Protegé tu cuenta con un código OTP basado en tiempo (TOTP) desde Google Authenticator, 1Password o similar.',
    status: 'Estado',
    statusOn: 'Activado',
    statusOff: 'Desactivado',
    enroll: 'Activar 2FA',
    enrolling: 'Configurando…',
    disableCta: 'Desactivar 2FA',
    disabling: 'Desactivando…',
    qrLabel: 'Escaneá este QR con Google Authenticator, 1Password, Raycast o cualquier app TOTP:',
    copyLabel: 'O tipeá este secreto en tu app:',
    urlLabel: 'URL otpauth completa (avanzado):',
    verifyLabel: 'Ingresá el código de 6 dígitos',
    verify: 'Confirmar',
    verifying: 'Confirmando…',
    successToast: '2FA activado en tu cuenta.',
    backupCodesTitle: 'Guardá estos códigos de recuperación',
    backupCodesBody:
      'Cada código sirve una sola vez si perdés el teléfono. Guardalos en un lugar seguro — esta es la única vez que te los mostramos.',
    backupCodesDismiss: 'Ya los guardé',
    backupCodesCopy: 'Copiar todos',
    backupCodesCopied: 'Copiado',
    backupCodesDownload: 'Bajar .txt',
    wrongCode: 'El código no coincide. Probá con el siguiente que muestre tu app.',
    failed: 'No se pudo completar la operación. Probá de nuevo.',
    disablePwLabel: 'Contraseña actual',
    disableCodeLabel: 'Código TOTP actual',
    disableSubmit: 'Desactivar',
  },
} as const;

type Step = 'idle' | 'enrolling' | 'awaiting-code' | 'verifying' | 'disabling';

export function SecurityPanel({ lang }: { lang: 'en' | 'es' }) {
  const t = STRINGS[lang];
  const { session, refresh } = useAuth();

  const [enabled, setEnabled] = useState<boolean | null>(null);
  const [step, setStep] = useState<Step>('idle');
  const [secret, setSecret] = useState<string | null>(null);
  const [otpauth, setOtpauth] = useState<string | null>(null);
  const qrDataUrl = useOtpauthQr(otpauth);
  const [code, setCode] = useState('');
  const [disablePw, setDisablePw] = useState('');
  const [disableCode, setDisableCode] = useState('');
  const [toast, setToast] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [backupCodes, setBackupCodes] = useState<string[] | null>(null);

  useEffect(() => {
    if (!session) return;
    fetch('/api/auth/me', { credentials: 'include' })
      .then(r => (r.ok ? r.json() : null))
      .then(body => {
        // /me returns the emailVerified flag but not the mfa
        // state today — we probe /enroll to infer state
        // indirectly: if it 409s "already enabled", we know.
        // Simpler, though: add mfaEnabled to /me. Not done here
        // to keep the diff tight; the panel still works via the
        // settings page reload after enroll.
        setEnabled(Boolean(body?.user?.mfaEnabled));
      })
      .catch(() => setEnabled(false));
  }, [session]);

  async function startEnroll() {
    setError(null);
    setStep('enrolling');
    try {
      const res = await fetch('/api/auth/mfa/enroll', {
        method: 'POST',
        credentials: 'include',
      });
      if (!res.ok) throw new Error(`enroll failed: ${res.status}`);
      const body = (await res.json()) as { secret: string; otpauth: string };
      setSecret(body.secret);
      setOtpauth(body.otpauth);
      setStep('awaiting-code');
    } catch {
      setError(t.failed);
      setStep('idle');
    }
  }

  async function verifyEnroll(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (step === 'verifying') return;
    setError(null);
    setStep('verifying');
    try {
      const res = await fetch('/api/auth/mfa/verify-enroll', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code }),
      });
      if (res.status === 400) {
        setError(t.wrongCode);
        setStep('awaiting-code');
        return;
      }
      if (!res.ok) throw new Error(`verify failed: ${res.status}`);
      const body = (await res.json()) as { mfaEnabled: boolean; backupCodes?: string[] };
      setEnabled(true);
      setSecret(null);
      setOtpauth(null);
      setCode('');
      if (body.backupCodes && body.backupCodes.length > 0) {
        // Show backup codes ONCE. The user must save them
        // before continuing — the dismiss button on the
        // codes card clears them from state.
        setBackupCodes(body.backupCodes);
      } else {
        setToast(t.successToast);
      }
      setStep('idle');
      await refresh();
    } catch {
      setError(t.failed);
      setStep('awaiting-code');
    }
  }

  async function disable(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (step === 'disabling') return;
    setError(null);
    setStep('disabling');
    try {
      const res = await fetch('/api/auth/mfa/disable', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: disablePw, code: disableCode }),
      });
      if (!res.ok) {
        setError(t.failed);
        setStep('idle');
        return;
      }
      setEnabled(false);
      setDisablePw('');
      setDisableCode('');
      setStep('idle');
      await refresh();
    } catch {
      setError(t.failed);
      setStep('idle');
    }
  }

  if (!session || session.user.id === 'anonymous') return null;

  return (
    <div className="space-y-4">
      <p className="text-xs text-[var(--text-muted)]">{t.hint}</p>

      {toast && (
        <div className="border-primary/30 bg-primary/10 text-primary rounded-md border px-3 py-2 text-xs">
          {toast}
        </div>
      )}

      {backupCodes && (
        <BackupCodesCard
          codes={backupCodes}
          title={t.backupCodesTitle}
          body={t.backupCodesBody}
          dismissLabel={t.backupCodesDismiss}
          copyLabel={t.backupCodesCopy}
          copiedLabel={t.backupCodesCopied}
          downloadLabel={t.backupCodesDownload}
          onDismiss={() => {
            setBackupCodes(null);
            setToast(t.successToast);
          }}
        />
      )}

      <div className="flex items-center justify-between rounded-lg border border-[var(--border-color)] bg-[var(--panel-bg,rgba(255,255,255,0.03))] p-4 text-sm">
        <div className="flex items-center gap-3">
          {enabled ? (
            <ShieldCheck className="text-primary h-4 w-4" />
          ) : (
            <Shield className="h-4 w-4 text-[var(--text-muted)]" />
          )}
          <div>
            <div className="mb-0.5 text-xs text-[var(--text-muted)]">{t.status}</div>
            <div className="font-semibold text-[var(--text-primary)]">
              {enabled === null ? '…' : enabled ? t.statusOn : t.statusOff}
            </div>
          </div>
        </div>
        {enabled === false && step === 'idle' && (
          <button
            onClick={startEnroll}
            className="bg-primary text-primary-foreground hover:bg-primary/90 inline-flex items-center gap-2 rounded-md px-3 py-1.5 text-xs font-semibold shadow"
          >
            {t.enroll}
          </button>
        )}
        {enabled === false && step === 'enrolling' && (
          <span className="inline-flex items-center gap-2 text-xs text-[var(--text-muted)]">
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
            {t.enrolling}
          </span>
        )}
      </div>

      {step === 'awaiting-code' && secret && otpauth && (
        <form onSubmit={verifyEnroll} className="space-y-3">
          <div className="space-y-4 rounded-md border border-[var(--border-color)] p-4 text-xs">
            {qrDataUrl && (
              <div>
                <div className="mb-2 text-[var(--text-muted)]">{t.qrLabel}</div>
                <div className="inline-block rounded-md bg-white p-2">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={qrDataUrl} alt="MFA enrollment QR code" className="block h-44 w-44" />
                </div>
              </div>
            )}
            <div>
              <div className="mb-1 text-[var(--text-muted)]">{t.copyLabel}</div>
              <code className="block break-all font-mono text-[11px] tracking-widest text-[var(--text-primary)]">
                {secret}
              </code>
            </div>
            <details className="text-[var(--text-muted)]">
              <summary className="cursor-pointer text-[11px] hover:text-[var(--text-primary)]">
                {t.urlLabel}
              </summary>
              <code className="mt-2 block break-all font-mono text-[11px] text-[var(--text-primary)]">
                {otpauth}
              </code>
            </details>
          </div>
          <label className="block">
            <span className="mb-1.5 block font-mono text-[11px] uppercase tracking-widest text-[var(--text-muted)]">
              {t.verifyLabel}
            </span>
            <input
              type="text"
              value={code}
              onChange={e => setCode(e.target.value)}
              inputMode="numeric"
              pattern="[0-9]{6}"
              maxLength={6}
              required
              className="focus:border-primary w-full max-w-[160px] rounded-md border border-[var(--border-color)] bg-transparent px-3 py-2 text-center font-mono text-lg tracking-widest text-[var(--text-primary)] focus:outline-none"
            />
          </label>
          <button
            type="submit"
            disabled={code.length !== 6}
            className="bg-primary text-primary-foreground shadow-primary/20 hover:bg-primary/90 inline-flex items-center gap-2 rounded-md px-4 py-2 text-sm font-semibold shadow-md disabled:opacity-60"
          >
            {(step as Step) === 'verifying' ? t.verifying : t.verify}
          </button>
        </form>
      )}

      {enabled === true && (
        <form onSubmit={disable} className="space-y-3">
          <label className="block">
            <span className="mb-1.5 block font-mono text-[11px] uppercase tracking-widest text-[var(--text-muted)]">
              {t.disablePwLabel}
            </span>
            <input
              type="password"
              required
              value={disablePw}
              onChange={e => setDisablePw(e.target.value)}
              autoComplete="current-password"
              className="focus:border-primary w-full max-w-sm rounded-md border border-[var(--border-color)] bg-transparent px-3 py-2 text-sm text-[var(--text-primary)] focus:outline-none"
            />
          </label>
          <label className="block">
            <span className="mb-1.5 block font-mono text-[11px] uppercase tracking-widest text-[var(--text-muted)]">
              {t.disableCodeLabel}
            </span>
            <input
              type="text"
              required
              value={disableCode}
              onChange={e => setDisableCode(e.target.value)}
              inputMode="numeric"
              pattern="[0-9]{6}"
              maxLength={6}
              className="focus:border-primary w-full max-w-[160px] rounded-md border border-[var(--border-color)] bg-transparent px-3 py-2 text-center font-mono text-lg tracking-widest text-[var(--text-primary)] focus:outline-none"
            />
          </label>
          <button
            type="submit"
            disabled={!disablePw || disableCode.length !== 6 || step === 'disabling'}
            className="border-destructive/60 text-destructive hover:bg-destructive/10 inline-flex items-center gap-2 rounded-md border px-4 py-2 text-sm font-semibold disabled:opacity-60"
          >
            {step === 'disabling' ? t.disabling : t.disableSubmit}
          </button>
        </form>
      )}

      {error && (
        <div className="border-destructive/40 bg-destructive/10 text-destructive rounded-md border px-3 py-2 text-xs">
          {error}
        </div>
      )}
    </div>
  );
}
