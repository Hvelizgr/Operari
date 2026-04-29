'use client';

import { ArrowRightToLine, Check } from 'lucide-react';
import { useState } from 'react';

import type { RequestPayload } from './RequestForm';

interface Props {
  payload: RequestPayload;
  lang: 'en' | 'es';
  disabled?: boolean;
}

const PENDING_STEP_KEY = 'operari:pendingHttpStep';

/**
 * Hands the current request off to the runbook editor as a pending
 * `operari.httpRequest` step. The editor reads this key on mount and
 * surfaces an "Import pending HTTP request" banner; clicking it
 * inserts the node and clears the key. We use localStorage instead
 * of in-memory state because the editor lives on a different route
 * (`/editor`) and the user may be in a different tab altogether.
 */
export interface PendingHttpStep {
  type: 'operari.httpRequest';
  config: {
    method: string;
    url: string;
    headers?: Record<string, string>;
    body?: string;
  };
  createdAt: number;
}

export default function ConvertToStepButton({ payload, lang, disabled }: Props) {
  const [done, setDone] = useState(false);

  const t =
    lang === 'es'
      ? { idle: 'A runbook', confirmed: 'Listo' }
      : { idle: 'To runbook', confirmed: 'Saved' };

  const handle = () => {
    if (disabled) return;
    const headers: Record<string, string> = {};
    for (const { key, value } of payload.headers) {
      const k = key.trim();
      if (k) headers[k] = value;
    }
    const pending: PendingHttpStep = {
      type: 'operari.httpRequest',
      config: {
        method: payload.method,
        url: payload.url.trim(),
        ...(Object.keys(headers).length > 0 ? { headers } : {}),
        ...(payload.body && payload.method !== 'GET' && payload.method !== 'HEAD'
          ? { body: payload.body }
          : {}),
      },
      createdAt: Date.now(),
    };
    try {
      window.localStorage.setItem(PENDING_STEP_KEY, JSON.stringify(pending));
      setDone(true);
      window.setTimeout(() => setDone(false), 1500);
    } catch {
      // localStorage failure shouldn't crash the page; the user can
      // still copy the request from the URL bar / form by hand.
    }
  };

  return (
    <button
      type="button"
      onClick={handle}
      disabled={disabled}
      title={
        lang === 'es'
          ? 'Guarda esta solicitud para importarla como step en el editor'
          : 'Stash this request so the editor can import it as a step'
      }
      className="hidden items-center gap-1.5 rounded border border-zinc-700 px-2.5 py-1.5 text-[11px] text-zinc-300 transition-colors hover:border-emerald-500/60 hover:text-emerald-300 disabled:opacity-40 disabled:hover:border-zinc-700 disabled:hover:text-zinc-300 sm:flex"
    >
      {done ? <Check size={11} className="text-emerald-400" /> : <ArrowRightToLine size={11} />}
      {done ? t.confirmed : t.idle}
    </button>
  );
}

export { PENDING_STEP_KEY };
