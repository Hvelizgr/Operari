'use client';

import { ArrowRightToLine, Check } from 'lucide-react';
import { useState } from 'react';

interface Props {
  query: string;
  /** Connected-account id of the selected DB. Required — a step
   *  without a connection target is an empty shell that just
   *  trips on validation later. The button is disabled when null. */
  credentialId: string;
  lang: 'en' | 'es';
  disabled?: boolean;
}

const PENDING_STEP_KEY = 'operari:pendingDbStep';

/**
 * Hands the current SQL query off to the runbook editor as a
 * pending `operari.database` step. Mirrors HTTP tester's
 * ConvertToStepButton (see ../HttpTester/ConvertToStepButton.tsx)
 * — same localStorage handoff pattern, same UI shape, just with
 * a SQL payload.
 *
 * The editor's PendingStepBanner reads this key on mount and
 * surfaces an "Import pending DB query" banner; clicking it
 * inserts the node and clears the key.
 *
 * localStorage instead of in-memory state because /sql-editor
 * and /editor live on different routes, possibly in different
 * tabs altogether. A user habitually iterates a query in the SQL
 * editor, then jumps to the editor to wire it into a runbook —
 * the handoff has to survive a navigation.
 */
export interface PendingDbStep {
  type: 'operari.database';
  config: {
    /** Connected-account id, resolved by the orchestrator at run
     *  time. The same id the SQL editor used to authenticate the
     *  query, so the step lands pointing at the same DB the user
     *  was iterating against. */
    credentialId: string;
    /** SQL text — copied verbatim. The orchestrator parses
     *  templates ({{vars.x}}) at run time, so an operator who
     *  added {{}} placeholders in the SQL editor for testing
     *  keeps them in the step. */
    query: string;
  };
  createdAt: number;
}

export default function ConvertToStepButton({ query, credentialId, lang, disabled }: Props) {
  const [done, setDone] = useState(false);

  const t =
    lang === 'es'
      ? { idle: 'A runbook', confirmed: 'Listo' }
      : { idle: 'To runbook', confirmed: 'Saved' };

  const isDisabled = disabled || !query.trim() || !credentialId;

  const handle = () => {
    if (isDisabled) return;
    const pending: PendingDbStep = {
      type: 'operari.database',
      config: {
        credentialId,
        query: query.trim(),
      },
      createdAt: Date.now(),
    };
    try {
      window.localStorage.setItem(PENDING_STEP_KEY, JSON.stringify(pending));
      setDone(true);
      window.setTimeout(() => setDone(false), 1500);
    } catch {
      // localStorage failure is rare (full disk / private mode).
      // The user can still copy the query by hand from the
      // editor; we don't surface a scary toast over a niche edge.
    }
  };

  return (
    <button
      type="button"
      onClick={handle}
      disabled={isDisabled}
      title={
        lang === 'es'
          ? 'Guarda este query para importarlo como step en el editor'
          : 'Stash this query so the editor can import it as a step'
      }
      className="hidden items-center gap-1.5 rounded border border-zinc-700 px-2.5 py-1.5 text-[11px] text-zinc-300 transition-colors hover:border-emerald-500/60 hover:text-emerald-300 disabled:opacity-40 disabled:hover:border-zinc-700 disabled:hover:text-zinc-300 sm:flex"
    >
      {done ? <Check size={11} className="text-emerald-400" /> : <ArrowRightToLine size={11} />}
      {done ? t.confirmed : t.idle}
    </button>
  );
}

export { PENDING_STEP_KEY };
