'use client';

import { AnimatePresence, motion } from 'framer-motion';
import { Link2, ShieldAlert, ShieldCheck } from 'lucide-react';
import { useParams } from 'next/navigation';
import { useRef } from 'react';

import { useSequence } from '../_shared/useSequence';

const EVENTS = [
  { kind: 'run.started', who: 'sentry', hash: '9a1f…04c2' },
  { kind: 'secret.read', who: 'vault', hash: '51be…e7a0' },
  { kind: 'approval.granted', who: '@sre-lead', hash: 'c03d…9b18', tampered: '@intern' },
  { kind: 'step.succeeded', who: 'helm', hash: '7e44…21fd' },
  { kind: 'run.completed', who: 'engine', hash: '3f9c…b2e1' },
];

const T = {
  en: {
    eyebrow: 'Audit chain',
    title: 'Every action, sealed to the one before it.',
    subtitle:
      'Each event stores the SHA-256 of the previous one. Change a single field after the fact and every hash after it stops matching — one command tells you exactly where.',
    verify: 'operari audit verify run_3f9c2b7a',
    ok: 'chain intact · 5/5 events verified',
    edit: 'someone edits event #3 in the database…',
    broken: 'chain broken at event #3 · hash mismatch',
    prev: 'prev',
  },
  es: {
    eyebrow: 'Cadena de auditoría',
    title: 'Cada acción, sellada a la anterior.',
    subtitle:
      'Cada evento guarda el SHA-256 del anterior. Cambiá un solo campo después y todos los hashes siguientes dejan de coincidir; un comando te dice exactamente dónde.',
    verify: 'operari audit verify run_3f9c2b7a',
    ok: 'cadena intacta · 5/5 eventos verificados',
    edit: 'alguien edita el evento #3 en la base…',
    broken: 'cadena rota en el evento #3 · el hash no coincide',
    prev: 'prev',
  },
};

// frames: 0 empty, 1-5 blocks append, 6 verify cmd, 7 ok, 8 edit, 9 tampered, 10 verify again, 11 broken (hold)
const DELAYS = [500, 650, 650, 650, 650, 900, 800, 2200, 1200, 1000, 800, 3800];

export default function AuditChain() {
  const params = useParams();
  const t = params?.lang === 'es' ? T.es : T.en;
  const ref = useRef<HTMLDivElement>(null);
  const { tick } = useSequence(ref, DELAYS);

  const shown = Math.min(tick, EVENTS.length);
  const tampered = tick >= 9;
  const result = tick >= 11 ? 'broken' : tick >= 7 && tick < 9 ? 'ok' : null;

  return (
    <section className="bg-background relative overflow-hidden py-24 sm:py-32">
      <div className="container mx-auto max-w-6xl px-4 sm:px-6">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-80px' }}
          transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
          className="mb-10 max-w-2xl sm:mb-14"
        >
          <span className="border-primary/30 bg-primary/10 text-primary mb-5 inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-medium">
            <Link2 className="h-3.5 w-3.5" />
            {t.eyebrow}
          </span>
          <h2 className="text-foreground text-3xl font-bold leading-[1.1] tracking-tight sm:text-4xl md:text-5xl">
            {t.title}
          </h2>
          <p className="text-muted-foreground mt-4 text-base leading-relaxed sm:text-lg">
            {t.subtitle}
          </p>
        </motion.div>

        <div ref={ref} aria-hidden="true">
          {/* Chain: vertical on phones, horizontal from md */}
          <div className="flex min-h-[400px] flex-col items-stretch gap-0 md:min-h-[170px] md:flex-row md:items-start">
            {EVENTS.map((e, i) => {
              const visible = i < shown;
              const bad = tampered && i >= 2;
              const origin = tampered && i === 2;
              return (
                <div
                  key={e.kind}
                  className="flex min-w-0 flex-col md:flex-1 md:flex-row md:items-center"
                >
                  {i > 0 && (
                    <div className="flex h-4 justify-center md:h-auto md:w-6 md:shrink-0">
                      <motion.div
                        initial={false}
                        animate={{ scaleY: visible ? 1 : 0, scaleX: visible ? 1 : 0 }}
                        transition={{ duration: 0.3 }}
                        className={`origin-top md:origin-left ${bad ? 'bg-red-500/70' : 'bg-primary/60'} h-full w-[2px] md:h-[2px] md:w-full`}
                      />
                    </div>
                  )}
                  <motion.div
                    initial={false}
                    animate={{
                      opacity: visible ? 1 : 0,
                      y: visible ? 0 : 12,
                      x: origin ? [0, -4, 4, -3, 3, 0] : 0,
                    }}
                    transition={{ duration: origin ? 0.45 : 0.4, ease: [0.22, 1, 0.36, 1] }}
                    className={`min-w-0 flex-1 rounded-xl border p-3 font-mono text-[11px] transition-colors duration-500 ${
                      bad ? 'border-red-500/50 bg-red-500/[0.07]' : 'border-border/70 bg-card/60'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2 md:mb-1">
                      <span className="text-muted-foreground">#{i + 1}</span>
                      <span className={bad ? 'text-red-300' : 'text-emerald-300/90'}>
                        {bad ? '✗' : '✓'}
                      </span>
                    </div>
                    <div className="flex min-w-0 items-baseline gap-2 md:block">
                      <div className="text-foreground truncate font-semibold">{e.kind}</div>
                      <div className="text-muted-foreground truncate">
                        by{' '}
                        <AnimatePresence mode="wait" initial={false}>
                          <motion.span
                            key={origin ? 'bad' : 'ok'}
                            initial={{ opacity: 0, y: -4 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: 4 }}
                            className={origin ? 'text-red-300' : 'text-foreground/80'}
                          >
                            {origin && e.tampered ? e.tampered : e.who}
                          </motion.span>
                        </AnimatePresence>
                      </div>
                    </div>
                    <div
                      className={`border-border/50 mt-1 truncate pt-1 md:mt-2 md:border-t md:pt-2 ${bad ? 'text-red-300/80 line-through decoration-red-400/60' : 'text-primary/80'}`}
                    >
                      {e.hash}
                    </div>
                    {i > 0 && (
                      <div className="text-muted-foreground/60 hidden truncate text-[10px] md:block">
                        {t.prev} {EVENTS[i - 1].hash}
                      </div>
                    )}
                  </motion.div>
                </div>
              );
            })}
          </div>

          {/* verify terminal */}
          <div className="border-border mt-6 min-h-[112px] rounded-xl border bg-[#07090c] p-4 font-mono text-[11px] sm:text-xs">
            <AnimatePresence mode="popLayout">
              {tick >= 6 && (
                <motion.div
                  key="cmd"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                >
                  <span className="text-primary">❯</span>{' '}
                  <span className="text-foreground/90 break-all">{t.verify}</span>
                </motion.div>
              )}
              {result === 'ok' && (
                <motion.div
                  key="ok"
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  className="mt-2 flex items-center gap-2 text-emerald-300"
                >
                  <ShieldCheck className="h-4 w-4 shrink-0" />
                  {t.ok}
                </motion.div>
              )}
              {tick >= 8 && tick < 11 && (
                <motion.div
                  key="edit"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="mt-2 text-amber-300/90"
                >
                  # {t.edit}
                </motion.div>
              )}
              {result === 'broken' && (
                <motion.div
                  key="broken"
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  className="mt-2 flex items-center gap-2 text-red-300"
                >
                  <ShieldAlert className="h-4 w-4 shrink-0" />
                  {t.broken}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>
    </section>
  );
}
