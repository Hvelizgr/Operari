'use client';

import { motion } from 'framer-motion';
import { AlertTriangle, Inbox as InboxIcon } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

interface StatusPillProps {
  lang: 'en' | 'es';
}

interface PillData {
  running: number;
  failing: number;
  pendingApprovals: number;
}

const LABELS = {
  en: { running: 'running', failing: 'failing', pending: 'pending', jump: 'Go to runs' },
  es: { running: 'en curso', failing: 'fallando', pending: 'pendientes', jump: 'Ir a ejecuciones' },
} as const;

// Persistent top-right indicator. Appears only when there's something worth
// showing (active runs, failures, approvals). Staying visible when idle
// would be noise — when all is well, take zero space.
export default function StatusPill({ lang }: StatusPillProps) {
  const router = useRouter();
  const [data, setData] = useState<PillData | null>(null);
  const [reducedMotion, setReducedMotion] = useState(false);
  const t = LABELS[lang];

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    setReducedMotion(mq.matches);
    const sync = (e: MediaQueryListEvent) => setReducedMotion(e.matches);
    mq.addEventListener('change', sync);
    return () => mq.removeEventListener('change', sync);
  }, []);

  useEffect(() => {
    const apiBase = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';
    let cancelled = false;
    const load = async () => {
      try {
        const res = await fetch(`${apiBase}/api/dashboard/overview`);
        if (!res.ok) return;
        const json = (await res.json()) as {
          liveRuns?: unknown[];
          attention?: {
            recentFailures?: unknown[];
            pendingApprovals?: unknown[];
            stuckRuns?: unknown[];
          };
        };
        if (cancelled) return;
        setData({
          running: json.liveRuns?.length ?? 0,
          failing:
            (json.attention?.recentFailures?.length ?? 0) +
            (json.attention?.stuckRuns?.length ?? 0),
          pendingApprovals: json.attention?.pendingApprovals?.length ?? 0,
        });
      } catch {
        /* silent — pill is ambient, never blocks */
      }
    };
    load();
    const id = setInterval(load, 30_000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, []);

  if (!data) return null;

  const hasUrgent = data.failing > 0 || data.pendingApprovals > 0;
  const hasRunning = data.running > 0;
  // Idle: nothing active, nothing wrong — don't render.
  if (!hasUrgent && !hasRunning) return null;

  return (
    <button
      onClick={() => router.push(`/${lang}/runs`)}
      aria-label={t.jump}
      className={`fixed right-4 top-4 z-[60] flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-medium shadow-lg backdrop-blur-md transition-colors ${
        hasUrgent
          ? 'border-red-500/40 bg-red-950/70 text-red-100 hover:bg-red-900/70'
          : 'border-white/10 bg-black/60 text-gray-200 hover:bg-zinc-900/80'
      }`}
    >
      <motion.span
        className={`inline-block h-2 w-2 rounded-full ${
          hasUrgent ? 'bg-red-400' : 'bg-emerald-400'
        }`}
        animate={
          hasRunning && !reducedMotion ? { opacity: [1, 0.4, 1], scale: [1, 1.25, 1] } : undefined
        }
        transition={{ duration: 1.4, repeat: Infinity, ease: 'easeInOut' }}
      />
      {hasRunning && (
        <span>
          {data.running} {t.running}
        </span>
      )}
      {data.failing > 0 && (
        <>
          {hasRunning && <span className="opacity-40">·</span>}
          <span className="flex items-center gap-1">
            <AlertTriangle size={11} />
            {data.failing} {t.failing}
          </span>
        </>
      )}
      {data.pendingApprovals > 0 && (
        <>
          {(hasRunning || data.failing > 0) && <span className="opacity-40">·</span>}
          <span className="flex items-center gap-1">
            <InboxIcon size={11} />
            {data.pendingApprovals} {t.pending}
          </span>
        </>
      )}
    </button>
  );
}
