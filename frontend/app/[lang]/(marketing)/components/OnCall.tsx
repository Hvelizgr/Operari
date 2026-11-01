'use client';

import { AnimatePresence, motion } from 'framer-motion';
import { Check, Hash, Moon, MousePointer2, Sparkles, TriangleAlert, Wrench } from 'lucide-react';
import { useParams } from 'next/navigation';
import { useRef } from 'react';

import { useSequence } from '../_shared/useSequence';

const T = {
  en: {
    eyebrow: '3:07 am',
    title: 'Built for the person who just got paged.',
    subtitle:
      'The run asks for a human only where it has to, right where on-call already is. When a step fails, the assist panel reads the logs before you do.',
    approvalTitle: 'Approve in Slack',
    approvalBody: 'rollback-last-deploy wants to run',
    approvalCmd: 'helm rollback api 41 → 40',
    approve: 'Approve',
    reject: 'Reject',
    approvedBy: 'approved by @sre-lead · run resumed',
    resumed: 'rollback ✓ 8.4s · error rate back to 0.2%',
    diagTitle: 'Failure diagnosis',
    logs: [
      'step migrate-db  exit 1',
      'ERROR: relation "orders_v2" already exists',
      'at prisma migrate deploy (0042_orders_v2)',
    ],
    thinking: 'reading logs and the last 3 runs…',
    diagnosis:
      'Migration 0042 was half-applied by the run that timed out at 02:58. The table exists but the migration row does not.',
    fix: 'Mark 0042 as applied, then retry',
    apply: 'Apply fix',
  },
  es: {
    eyebrow: '3:07 am',
    title: 'Hecho para el on-call que acaban de despertar.',
    subtitle:
      'El run pide un humano solo donde hace falta, justo donde ya está el on-call. Cuando un paso falla, el panel de asistencia lee los logs antes que vos.',
    approvalTitle: 'Aprobá desde Slack',
    approvalBody: 'rollback-last-deploy quiere ejecutarse',
    approvalCmd: 'helm rollback api 41 → 40',
    approve: 'Aprobar',
    reject: 'Rechazar',
    approvedBy: 'aprobado por @sre-lead · el run sigue',
    resumed: 'rollback ✓ 8.4s · error rate vuelve a 0.2%',
    diagTitle: 'Diagnóstico de fallas',
    logs: [
      'step migrate-db  exit 1',
      'ERROR: relation "orders_v2" already exists',
      'at prisma migrate deploy (0042_orders_v2)',
    ],
    thinking: 'leyendo logs y los últimos 3 runs…',
    diagnosis:
      'La migración 0042 quedó a medias en el run que hizo timeout a las 02:58. La tabla existe pero la fila de la migración no.',
    fix: 'Marcar 0042 como aplicada y reintentar',
    apply: 'Aplicar fix',
  },
};

export default function OnCall() {
  const params = useParams();
  const t = params?.lang === 'es' ? T.es : T.en;

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
          <span className="mb-5 inline-flex items-center gap-2 rounded-full border border-indigo-400/30 bg-indigo-400/10 px-3 py-1 font-mono text-xs font-medium text-indigo-300">
            <Moon className="h-3.5 w-3.5" />
            {t.eyebrow}
          </span>
          <h2 className="text-foreground text-3xl font-bold leading-[1.1] tracking-tight sm:text-4xl md:text-5xl">
            {t.title}
          </h2>
          <p className="text-muted-foreground mt-4 text-base leading-relaxed sm:text-lg">
            {t.subtitle}
          </p>
        </motion.div>

        <div className="grid grid-cols-1 gap-5 lg:grid-cols-2" aria-hidden="true">
          <ApprovalCard t={t} />
          <DiagnosisCard t={t} />
        </div>
      </div>
    </section>
  );
}

type Strings = typeof T.en;

// frames: 0 empty, 1 message, 2 cursor moves, 3 press, 4 approved, 5 resumed (hold)
const APPROVAL_DELAYS = [600, 1200, 900, 350, 1100, 4200];

function ApprovalCard({ t }: { t: Strings }) {
  const ref = useRef<HTMLDivElement>(null);
  const { tick } = useSequence(ref, APPROVAL_DELAYS);
  const pressed = tick >= 3;
  const approved = tick >= 4;

  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-80px' }}
      transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
      className="border-border bg-card/80 relative min-w-0 overflow-hidden rounded-2xl border shadow-2xl shadow-black/30"
    >
      <div className="border-border/70 bg-card/60 flex items-center gap-2 border-b px-4 py-2.5 text-sm">
        <Hash className="text-muted-foreground h-4 w-4" />
        <span className="text-foreground font-semibold">oncall</span>
        <span className="text-muted-foreground ml-auto text-xs">{t.approvalTitle}</span>
      </div>

      <div className="min-h-[300px] p-4">
        <AnimatePresence>
          {tick >= 1 && (
            <motion.div
              key="message"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.4 }}
              className="flex gap-3"
            >
              <div className="bg-primary/15 border-primary/30 text-primary flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border text-sm font-bold">
                O
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-baseline gap-2">
                  <span className="text-foreground text-sm font-bold">Operari</span>
                  <span className="bg-secondary text-muted-foreground rounded px-1 text-[10px]">
                    APP
                  </span>
                  <span className="text-muted-foreground text-[11px]">3:07</span>
                </div>
                <p className="text-foreground/90 mt-0.5 text-sm">
                  <TriangleAlert className="mr-1 inline h-3.5 w-3.5 text-amber-400" />
                  {t.approvalBody}
                </p>
                <div className="border-l-primary/60 bg-background/40 text-foreground/80 mt-2 rounded border-l-2 px-3 py-2 font-mono text-[11px]">
                  {t.approvalCmd}
                </div>

                <div className="relative mt-3 flex gap-2">
                  <motion.span
                    animate={
                      approved
                        ? { backgroundColor: 'rgba(16,185,129,0.2)' }
                        : { scale: pressed ? 0.94 : 1 }
                    }
                    className="bg-primary text-primary-foreground inline-flex items-center gap-1 rounded-md px-3 py-1.5 text-xs font-semibold"
                    style={approved ? { color: 'rgb(110,231,183)' } : undefined}
                  >
                    {approved && <Check className="h-3.5 w-3.5" />}
                    {t.approve}
                  </motion.span>
                  <span className="border-border text-muted-foreground rounded-md border px-3 py-1.5 text-xs font-semibold">
                    {t.reject}
                  </span>

                  {/* Fake pointer that travels to the Approve button */}
                  <motion.div
                    className="pointer-events-none absolute left-0 top-0"
                    initial={false}
                    animate={
                      tick >= 2 && tick < 4
                        ? { x: 34, y: 14, opacity: 1, scale: pressed ? 0.85 : 1 }
                        : { x: 180, y: 70, opacity: 0, scale: 1 }
                    }
                    transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
                  >
                    <MousePointer2 className="h-5 w-5 fill-white text-black drop-shadow" />
                  </motion.div>
                </div>

                <AnimatePresence>
                  {approved && (
                    <motion.p
                      key="approved"
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0 }}
                      className="text-muted-foreground mt-3 text-xs"
                    >
                      ✓ {t.approvedBy}
                    </motion.p>
                  )}
                  {tick >= 5 && (
                    <motion.div
                      key="resumed"
                      initial={{ opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0 }}
                      className="mt-3 rounded-md border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 font-mono text-[11px] text-emerald-300"
                    >
                      {t.resumed}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}

const DIAG_CHARS_PER_FRAME = 4;

function DiagnosisCard({ t }: { t: Strings }) {
  const ref = useRef<HTMLDivElement>(null);
  const typeFrames = Math.ceil(t.diagnosis.length / DIAG_CHARS_PER_FRAME);
  // 0 empty, 1-3 log lines, 4 thinking, 5..5+typeFrames typing, then fix, then press, hold
  const delays = [
    500,
    450,
    450,
    900,
    1600,
    ...Array.from({ length: typeFrames }, () => 40),
    700,
    900,
    3800,
  ];
  const { tick } = useSequence(ref, delays);

  const logs = Math.min(tick, 3);
  const thinking = tick === 4;
  const typedFrames = Math.max(0, Math.min(tick - 5, typeFrames));
  const typed = t.diagnosis.slice(0, typedFrames * DIAG_CHARS_PER_FRAME);
  const showFix = tick >= 5 + typeFrames;
  const applied = tick >= 6 + typeFrames + 1;

  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-80px' }}
      transition={{ duration: 0.6, delay: 0.1, ease: [0.22, 1, 0.36, 1] }}
      className="border-border bg-card/80 relative min-w-0 overflow-hidden rounded-2xl border shadow-2xl shadow-black/30"
    >
      <div className="border-border/70 bg-card/60 flex items-center gap-2 border-b px-4 py-2.5 text-sm">
        <Sparkles className="h-4 w-4 text-violet-300" />
        <span className="text-foreground font-semibold">{t.diagTitle}</span>
        <span className="ml-auto rounded bg-red-500/15 px-1.5 py-0.5 font-mono text-[10px] text-red-300">
          FAILED
        </span>
      </div>

      <div className="min-h-[300px] p-4">
        <div className="min-h-[64px] rounded-lg bg-[#07090c] p-3 font-mono text-[11px] leading-relaxed">
          {t.logs.slice(0, logs).map((l, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, x: -6 }}
              animate={{ opacity: 1, x: 0 }}
              className={`truncate ${i === 1 ? 'text-red-300' : 'text-muted-foreground'}`}
            >
              {l}
            </motion.div>
          ))}
        </div>

        <div className="mt-4 flex gap-3">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-violet-400/30 bg-violet-400/10">
            <motion.span
              animate={thinking ? { rotate: [0, 15, -15, 0], scale: [1, 1.15, 1] } : {}}
              transition={{ duration: 1, repeat: thinking ? Infinity : 0 }}
            >
              <Sparkles className="h-4 w-4 text-violet-300" />
            </motion.span>
          </div>
          <div className="min-w-0 flex-1 text-sm">
            {thinking && (
              <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: [0.4, 1, 0.4] }}
                transition={{ duration: 1.4, repeat: Infinity }}
                className="text-muted-foreground text-xs"
              >
                {t.thinking}
              </motion.p>
            )}
            {tick >= 5 && (
              <p className="text-foreground/90 leading-relaxed">
                {typed}
                {!showFix && (
                  <span className="ml-0.5 inline-block h-[1em] w-[2px] translate-y-[2px] animate-pulse bg-violet-300" />
                )}
              </p>
            )}
            <AnimatePresence>
              {showFix && (
                <motion.div
                  key="fix"
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  className="border-border/70 bg-background/40 mt-3 flex flex-wrap items-center gap-3 rounded-lg border p-3"
                >
                  <Wrench className="h-4 w-4 shrink-0 text-violet-300" />
                  <span className="text-foreground/90 min-w-0 flex-1 text-xs">{t.fix}</span>
                  <motion.span
                    animate={
                      applied
                        ? { scale: 1 }
                        : {
                            scale: [1, 1.06, 1],
                            boxShadow: [
                              '0 0 0 0 rgba(167,139,250,0.5)',
                              '0 0 0 8px rgba(167,139,250,0)',
                              '0 0 0 0 rgba(167,139,250,0)',
                            ],
                          }
                    }
                    transition={{ duration: 1.2, repeat: applied ? 0 : Infinity }}
                    className={`inline-flex items-center gap-1 rounded-md px-3 py-1.5 text-xs font-semibold ${
                      applied ? 'bg-emerald-500/15 text-emerald-300' : 'bg-violet-500 text-white'
                    }`}
                  >
                    {applied && <Check className="h-3.5 w-3.5" />}
                    {t.apply}
                  </motion.span>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
