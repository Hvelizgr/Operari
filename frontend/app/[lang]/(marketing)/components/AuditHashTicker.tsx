'use client';

import { ShieldCheck } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';

/**
 * Audit-hash ticker — narrow strip in the footer that scrolls fake
 * SHA-256 prefix → next pairs in a marquee, simulating a live audit
 * chain. Reinforces the "every action is hash-chained" message
 * without taking visual space (~22px tall).
 *
 * Why "fake" hashes: the landing has no live tenant; we generate
 * deterministic-looking hex strings client-side. The eyebrow label
 * makes the scope explicit ("EXAMPLE CHAIN") so a careful reader
 * understands these aren't real production hashes — same honesty bar
 * as the rest of the landing.
 *
 * Desktop-only: hidden on `<md` because narrow viewports already pay
 * a layout cost from the column grid; an extra horizontal scroll
 * strip on mobile is noise.
 *
 * `prefers-reduced-motion`: short-circuits to a static, non-animated
 * row showing 4 example hashes — same content, no movement.
 */

function randomHex(len: number): string {
  // Hex-only glyph pool. Math.random per-char is fine — these are
  // decoration, not crypto, and the ticker is hidden under reduced
  // motion anyway.
  const chars = '0123456789abcdef';
  let out = '';
  for (let i = 0; i < len; i++) out += chars[Math.floor(Math.random() * chars.length)];
  return out;
}

function generateChain(count: number): Array<{ prev: string; next: string }> {
  // Build a 1-deep chain so each row's `next` matches the next row's
  // `prev` — reads as a real chain, not a list of unrelated hashes.
  const tail: Array<{ prev: string; next: string }> = [];
  let prev = randomHex(8);
  for (let i = 0; i < count; i++) {
    const next = randomHex(8);
    tail.push({ prev, next });
    prev = next;
  }
  return tail;
}

interface AuditHashTickerProps {
  lang: 'en' | 'es';
}

export default function AuditHashTicker({ lang }: AuditHashTickerProps) {
  // Generate once on mount so the chain stays visually stable for
  // the duration of the page view. The marquee animation is CSS
  // only — no JS frame loop.
  const chain = useMemo(() => generateChain(12), []);
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    setReduced(mq.matches);
    const handler = (e: MediaQueryListEvent) => setReduced(e.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);

  const t =
    lang === 'es'
      ? { eyebrow: 'CADENA DE EJEMPLO · sha-256' }
      : { eyebrow: 'EXAMPLE CHAIN · sha-256' };

  return (
    <div
      aria-hidden="true"
      className="border-border/40 hidden overflow-hidden border-y bg-black/20 md:block"
    >
      <div className="container mx-auto flex max-w-6xl items-center gap-3 px-4 md:px-6">
        <span className="text-muted-foreground/70 my-2 inline-flex shrink-0 items-center gap-1.5 font-mono text-[10px] font-semibold uppercase tracking-[0.18em]">
          <ShieldCheck className="h-3 w-3 text-emerald-400/70" />
          {t.eyebrow}
        </span>
        <div className="audit-ticker-mask relative my-2 min-w-0 flex-1">
          {reduced ? (
            // Static fallback — first 4 entries, no marquee. Same
            // visual density as the live row so the layout doesn't
            // jump for users who toggle the OS-level setting.
            <div className="flex gap-8 font-mono text-[11px] text-zinc-500">
              {chain.slice(0, 4).map((entry, i) => (
                <span key={i} className="whitespace-nowrap">
                  <span className="text-zinc-700">{entry.prev}</span>
                  <span className="mx-1.5 text-emerald-400/60">→</span>
                  <span className="text-zinc-400">{entry.next}</span>
                </span>
              ))}
            </div>
          ) : (
            <div className="audit-ticker-track flex gap-8 font-mono text-[11px] text-zinc-500">
              {/* Duplicate the chain inline so the marquee can loop
                  seamlessly: when the first copy scrolls out, the
                  second copy is already in view. CSS animation
                  shifts -50% (one full chain width) over 60s. */}
              {[...chain, ...chain].map((entry, i) => (
                <span key={i} className="whitespace-nowrap">
                  <span className="text-zinc-700">{entry.prev}</span>
                  <span className="mx-1.5 text-emerald-400/60">→</span>
                  <span className="text-zinc-400">{entry.next}</span>
                </span>
              ))}
            </div>
          )}
        </div>
      </div>
      <style jsx>{`
        .audit-ticker-mask {
          mask-image: linear-gradient(90deg, transparent, black 8%, black 92%, transparent);
        }
        .audit-ticker-track {
          animation: audit-ticker-scroll 60s linear infinite;
          width: max-content;
        }
        @keyframes audit-ticker-scroll {
          from {
            transform: translateX(0);
          }
          to {
            transform: translateX(-50%);
          }
        }
      `}</style>
    </div>
  );
}
