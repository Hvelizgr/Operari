'use client';

import { Anchor, UserCheck } from 'lucide-react';
import { useEffect, useState } from 'react';

import ApprovalInbox from './ApprovalInbox';
import WaitpointInbox from './WaitpointInbox';

type Tab = 'approvals' | 'waitpoints';

const STORAGE_KEY = 'operari:inbox:tab';

const STRINGS: Record<'en' | 'es', Record<Tab, string>> = {
  en: {
    approvals: 'Approvals',
    waitpoints: 'Wait tokens',
  },
  es: {
    approvals: 'Aprobaciones',
    waitpoints: 'Tokens de espera',
  },
};

interface PendingCount {
  approvals: number | null;
  waitpoints: number | null;
}

/**
 * Top-level inbox switcher. Holds two equally-weighted streams of
 * "things waiting on a human" — approvals (decision UI) and
 * waitpoints (URL handoff). Two streams instead of one because the
 * mental model is genuinely different: an approval needs a click,
 * a waitpoint needs a URL handed to a vendor.
 *
 * Persists the active tab in localStorage so an operator who lives
 * in one stream isn't forced back to the default on every reload.
 * The pending count badges fetch independently so a hung/slow API
 * for one stream doesn't blank the other tab's count.
 */
export default function InboxTabs({ lang }: { lang: 'en' | 'es' }) {
  const apiBase = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';
  const t = STRINGS[lang] ?? STRINGS.en;

  const [active, setActive] = useState<Tab>('approvals');
  const [counts, setCounts] = useState<PendingCount>({ approvals: null, waitpoints: null });

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (stored === 'approvals' || stored === 'waitpoints') setActive(stored);
  }, []);

  const select = (tab: Tab) => {
    setActive(tab);
    if (typeof window !== 'undefined') window.localStorage.setItem(STORAGE_KEY, tab);
  };

  // Fetch pending counts in parallel — independent fetches so one
  // slow endpoint can't gate the other badge from rendering.
  useEffect(() => {
    let cancelled = false;
    const loadCounts = async () => {
      const approvalsP = fetch(`${apiBase}/api/approvals?status=PENDING&limit=1`)
        .then(r => (r.ok ? r.json() : null))
        .catch(() => null);
      const waitpointsP = fetch(`${apiBase}/api/waitpoints?status=PENDING&limit=200`)
        .then(r => (r.ok ? r.json() : null))
        .catch(() => null);
      const [a, w] = await Promise.all([approvalsP, waitpointsP]);
      if (cancelled) return;
      setCounts({
        // Approvals API returns { data, nextCursor } — the count
        // for the badge isn't a first-class field, so we use
        // data.length as a floor (capped at 1 since we requested
        // limit=1) and rely on the UI saying "1+" when truncated.
        // For waitpoints we requested a higher limit so the count
        // is exact up to 200.
        approvals: Array.isArray(a?.data) ? a.data.length : 0,
        waitpoints: Array.isArray(w?.data) ? w.data.length : 0,
      });
    };
    void loadCounts();
    const interval = setInterval(loadCounts, 30_000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [apiBase]);

  const renderBadge = (n: number | null, capped?: boolean) => {
    if (n === null || n === 0) return null;
    return (
      <span className="ml-1 rounded-full bg-violet-600/80 px-1.5 py-0.5 text-[10px] font-bold text-white">
        {capped && n >= 1 ? '1+' : n}
      </span>
    );
  };

  return (
    <div>
      <div className="border-b border-zinc-800 bg-black px-4 sm:px-6">
        <div className="mx-auto flex max-w-5xl items-center gap-1">
          <button
            onClick={() => select('approvals')}
            className={`flex items-center gap-2 border-b-2 px-3 py-3 text-sm font-medium transition ${
              active === 'approvals'
                ? 'border-white text-white'
                : 'border-transparent text-zinc-500 hover:text-zinc-300'
            }`}
          >
            <UserCheck size={14} />
            {t.approvals}
            {renderBadge(counts.approvals, true)}
          </button>
          <button
            onClick={() => select('waitpoints')}
            className={`flex items-center gap-2 border-b-2 px-3 py-3 text-sm font-medium transition ${
              active === 'waitpoints'
                ? 'border-white text-white'
                : 'border-transparent text-zinc-500 hover:text-zinc-300'
            }`}
          >
            <Anchor size={14} />
            {t.waitpoints}
            {renderBadge(counts.waitpoints)}
          </button>
        </div>
      </div>
      {active === 'approvals' ? <ApprovalInbox lang={lang} /> : <WaitpointInbox lang={lang} />}
    </div>
  );
}
