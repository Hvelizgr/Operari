'use client';

import { motion } from 'framer-motion';
import { Check, Loader2 } from 'lucide-react';
import { useParams } from 'next/navigation';
import { useRef } from 'react';

import { useSequence } from '../_shared/useSequence';

// Mirrors the services in docker-compose.yml, in start order.
const SERVICES = [
  { name: 'postgres', note: 'healthy' },
  { name: 'redis', note: 'healthy' },
  { name: 'migrate', note: 'exited (0)' },
  { name: 'backend', note: ':4000' },
  { name: 'frontend', note: ':3000' },
];

// 0 idle, 1..5 each service starting, 6..10 each healthy, 11 ready (hold)
const DELAYS = [600, 250, 250, 250, 250, 250, 600, 500, 900, 700, 700, 4200];

/** Below the copy-paste block: what `docker compose up` does next. */
export default function ComposeBoot() {
  const params = useParams();
  const es = params?.lang === 'es';
  const ref = useRef<HTMLDivElement>(null);
  const { tick } = useSequence(ref, DELAYS);

  return (
    <div
      ref={ref}
      aria-hidden="true"
      className="border-border/50 border-t bg-[#07090c] px-4 py-4 font-mono text-[11px] sm:px-5 sm:text-xs"
    >
      <div className="space-y-1">
        {SERVICES.map((s, i) => {
          const started = tick >= i + 1;
          const healthy = tick >= i + 6;
          if (!started) return <div key={s.name} className="h-[1.4em]" />;
          return (
            <motion.div
              key={s.name}
              initial={{ opacity: 0, x: -6 }}
              animate={{ opacity: 1, x: 0 }}
              className="flex items-center gap-2"
            >
              {healthy ? (
                <motion.span initial={{ scale: 0 }} animate={{ scale: 1 }}>
                  <Check className="h-3.5 w-3.5 text-emerald-400" />
                </motion.span>
              ) : (
                <Loader2 className="text-primary h-3.5 w-3.5 animate-spin" />
              )}
              <span className="text-muted-foreground">Container</span>
              <span className="text-foreground/90">operari-{s.name}</span>
              <span
                className={`ml-auto ${healthy ? 'text-emerald-300/90' : 'text-muted-foreground'}`}
              >
                {healthy ? s.note : es ? 'iniciando' : 'starting'}
              </span>
            </motion.div>
          );
        })}
      </div>
      <motion.div
        initial={false}
        animate={{ opacity: tick >= 11 ? 1 : 0, y: tick >= 11 ? 0 : 4 }}
        className="border-border/50 text-primary mt-3 border-t pt-3"
      >
        ➜ {es ? 'listo en' : 'ready on'} http://localhost:3000
      </motion.div>
    </div>
  );
}
