'use client';

import { AnimatePresence, motion } from 'framer-motion';
import { AlertTriangle, Inbox as InboxIcon, X } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

import { motionFor, overlayPillVariants, reducedOverlayPillVariants } from '@/lib/motion';

interface StatusPillProps {
  lang: 'en' | 'es';
}

interface PillData {
  running: number;
  failing: number;
  pendingApprovals: number;
}

// Snapshot of counts the operator has already acknowledged. Stored in
// localStorage so dismissals survive navigation + refresh. The pill
// stays hidden as long as every current count is ≤ the acked value;
// it re-appears as soon as any count grows (new failure, new approval,
// new run). The "≤" rule means runs that finish (running drops) keep
// the pill silent — only NEW activity calls attention.
interface AckedSnapshot {
  running: number;
  failing: number;
  pendingApprovals: number;
}

const ACK_KEY = 'operari:status-pill-acked';

function readAck(): AckedSnapshot | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(ACK_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<AckedSnapshot>;
    if (
      typeof parsed.running !== 'number' ||
      typeof parsed.failing !== 'number' ||
      typeof parsed.pendingApprovals !== 'number'
    ) {
      return null;
    }
    return parsed as AckedSnapshot;
  } catch {
    return null;
  }
}

function writeAck(snapshot: AckedSnapshot) {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(ACK_KEY, JSON.stringify(snapshot));
  } catch {
    /* quota / unavailable — non-fatal, pill just stays visible */
  }
}

const LABELS = {
  en: {
    running: 'running',
    failing: 'failing',
    pending: 'pending',
    jump: 'Go to runs',
    dismiss: 'Dismiss',
  },
  es: {
    running: 'en curso',
    failing: 'fallando',
    pending: 'pendientes',
    jump: 'Ir a ejecuciones',
    dismiss: 'Descartar',
  },
} as const;

// Persistent top-right indicator. Appears only when there's something worth
// showing (active runs, failures, approvals). Staying visible when idle
// would be noise — when all is well, take zero space.
export default function StatusPill({ lang }: StatusPillProps) {
  const router = useRouter();
  const [data, setData] = useState<PillData | null>(null);
  const [acked, setAcked] = useState<AckedSnapshot | null>(null);
  const [reducedMotion, setReducedMotion] = useState(false);
  const t = LABELS[lang];

  // Hydrate the acknowledged snapshot from localStorage post-mount
  // (SSR has no window). Cross-tab sync is handled via the `storage`
  // event so dismissing in one tab clears the pill in others.
  useEffect(() => {
    setAcked(readAck());
    if (typeof window === 'undefined') return;
    const onStorage = (e: StorageEvent) => {
      if (e.key !== ACK_KEY) return;
      setAcked(readAck());
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    setReducedMotion(mq.matches);
    const sync = (e: MediaQueryListEvent) => setReducedMotion(e.matches);
    mq.addEventListener('change', sync);
    return () => mq.removeEventListener('change', sync);
  }, []);

  const acknowledge = (snapshot: PillData) => {
    writeAck(snapshot);
    setAcked(snapshot);
  };

  const handleClick = () => {
    if (data) acknowledge(data);
    router.push(`/${lang}/runs`);
  };

  const handleDismiss = (event: React.MouseEvent) => {
    // Stop the click from bubbling to the parent button (which would
    // navigate). The dismiss icon is purely "I've seen this".
    event.stopPropagation();
    if (data) acknowledge(data);
  };

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

  const hasUrgent = Boolean(data) && (data!.failing > 0 || data!.pendingApprovals > 0);
  const hasRunning = Boolean(data) && data!.running > 0;
  // Acknowledged: every current count is ≤ the snapshot the operator
  // dismissed. Once a count grows (new failure / approval / run), the
  // pill comes back even without changing the localStorage entry.
  const isAcked =
    Boolean(data) &&
    Boolean(acked) &&
    data!.running <= acked!.running &&
    data!.failing <= acked!.failing &&
    data!.pendingApprovals <= acked!.pendingApprovals;
  // Idle (or no data yet): nothing active, nothing wrong — don't
  // render. AnimatePresence handles the exit transition when the
  // state flips from active → idle so the pill fades out instead
  // of popping.
  const shouldShow = Boolean(data) && (hasUrgent || hasRunning) && !isAcked;
  const pillVariants = motionFor(overlayPillVariants, reducedOverlayPillVariants);

  return (
    <AnimatePresence>
      {shouldShow && (
        <motion.div
          key="status-pill"
          variants={pillVariants}
          initial="initial"
          animate="animate"
          exit="exit"
          className={`fixed right-4 top-4 z-[60] flex items-center gap-1 rounded-full border px-1 py-1 text-xs font-medium shadow-lg backdrop-blur-md transition-colors ${
            hasUrgent
              ? 'border-red-500/40 bg-red-950/70 text-red-100'
              : 'border-white/10 bg-black/60 text-gray-200'
          }`}
        >
          <button
            onClick={handleClick}
            aria-label={t.jump}
            className={`flex items-center gap-2 rounded-full px-2 py-0.5 transition-colors ${
              hasUrgent ? 'hover:bg-red-900/40' : 'hover:bg-zinc-900/40'
            }`}
          >
            <motion.span
              className={`inline-block h-2 w-2 rounded-full ${
                hasUrgent ? 'bg-red-400' : 'bg-emerald-400'
              }`}
              animate={
                hasRunning && !reducedMotion
                  ? { opacity: [1, 0.4, 1], scale: [1, 1.25, 1] }
                  : undefined
              }
              transition={{ duration: 1.4, repeat: Infinity, ease: 'easeInOut' }}
            />
            {hasRunning && data && (
              <span>
                {data.running} {t.running}
              </span>
            )}
            {data && data.failing > 0 && (
              <>
                {hasRunning && <span className="opacity-40">·</span>}
                <span className="flex items-center gap-1">
                  <AlertTriangle size={11} />
                  {data.failing} {t.failing}
                </span>
              </>
            )}
            {data && data.pendingApprovals > 0 && (
              <>
                {(hasRunning || data.failing > 0) && <span className="opacity-40">·</span>}
                <span className="flex items-center gap-1">
                  <InboxIcon size={11} />
                  {data.pendingApprovals} {t.pending}
                </span>
              </>
            )}
          </button>
          {/* Dismiss button — splits the click so "x" silences the
            current snapshot without navigating. The pill re-appears
            only when a count grows past what the operator just
            acknowledged. */}
          <button
            type="button"
            onClick={handleDismiss}
            aria-label={t.dismiss}
            className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full transition-colors ${
              hasUrgent
                ? 'text-red-200/70 hover:bg-red-900/50 hover:text-red-100'
                : 'text-gray-400 hover:bg-zinc-800 hover:text-gray-200'
            }`}
          >
            <X size={11} />
          </button>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
