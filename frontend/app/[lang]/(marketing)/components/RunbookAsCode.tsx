'use client';

import { AnimatePresence, motion } from 'framer-motion';
import { Check, FileCode2, Loader2, RotateCcw, Terminal } from 'lucide-react';
import { useParams } from 'next/navigation';
import { Fragment, useMemo, useRef } from 'react';

import { useSequence } from '../_shared/useSequence';

const YAML = [
  'name: rollback-last-deploy',
  'trigger:',
  '  sentry: { project: api, level: fatal }',
  'steps:',
  '  - id: logs',
  '    run: kubectl logs deploy/api --since=10m',
  '  - id: approve',
  '    approval: { channel: "#oncall" }',
  '  - id: rollback',
  '    run: helm rollback api',
  '  - id: notify',
  '    slack: { channel: "#incidents" }',
];

// Typing one character per timer tick is throttled on phones; a few per tick still reads as typing.
const CHARS_PER_FRAME = 5;

const STEPS = [
  { id: 'logs', ms: '1.2s' },
  { id: 'approve', ms: '14s' },
  { id: 'rollback', ms: '8.4s' },
  { id: 'notify', ms: '0.3s' },
];

const T = {
  en: {
    eyebrow: 'Runbooks as code',
    title: 'Write it once. Run it the same way every time.',
    subtitle:
      'A runbook is a YAML file in your repo. Review it in a PR, dry-run it against prod, and let the engine walk it step by step — pausing for a human where it matters.',
    cmd: 'operari run runbooks/rollback.yaml --dry-run',
    plan: 'plan · 4 steps · 1 approval gate',
    waiting: 'waiting on @oncall',
    approved: 'approved by @sre-lead',
    done: 'run completed · audit chain sealed',
    replay: 'Replay',
  },
  es: {
    eyebrow: 'Runbooks como código',
    title: 'Escribilo una vez. Corre igual cada vez.',
    subtitle:
      'Un runbook es un YAML en tu repo. Lo revisás en un PR, lo probás en dry-run contra prod y el motor lo recorre paso a paso, pausando para un humano donde importa.',
    cmd: 'operari run runbooks/rollback.yaml --dry-run',
    plan: 'plan · 4 pasos · 1 aprobación',
    waiting: 'esperando a @oncall',
    approved: 'aprobado por @sre-lead',
    done: 'run completado · cadena de auditoría sellada',
    replay: 'Repetir',
  },
};

export default function RunbookAsCode() {
  const params = useParams();
  const t = params?.lang === 'es' ? T.es : T.en;
  const ref = useRef<HTMLDivElement>(null);

  // Frame plan: one frame per typed character, then the CLI beats, then a hold.
  const totalChars = useMemo(() => YAML.reduce((n, l) => n + l.length + 1, 0), []);
  const cliBeats = [700, 600, 900, 900, 1400, 900, 900, 700, 4200];
  const typeFrames = Math.ceil(totalChars / CHARS_PER_FRAME);
  const delays = useMemo(
    () => [400, ...Array.from({ length: typeFrames }, () => 45), ...cliBeats],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [typeFrames]
  );
  const { tick, restart } = useSequence(ref, delays);

  const typed = Math.min(Math.max(tick - 1, 0) * CHARS_PER_FRAME, totalChars);
  const cli = Math.max(tick - 1 - typeFrames, -1);

  let left = typed;
  const lines = YAML.map(line => {
    const shown = line.slice(0, Math.max(0, left));
    left -= line.length + 1;
    return shown;
  });
  const cursorLine = Math.min(
    lines.findIndex((l, i) => l.length < YAML[i].length),
    YAML.length - 1
  );

  // cli: 0 = command, 1 = plan, 2.. = steps (logs, approve wait, approve ok, rollback, notify), last = done
  const stepState = (i: number): 'idle' | 'run' | 'ok' => {
    const start = [2, 3, 5, 6][i];
    const end = [3, 5, 6, 7][i];
    if (cli >= end) return 'ok';
    if (cli >= start) return 'run';
    return 'idle';
  };

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
            <FileCode2 className="h-3.5 w-3.5" />
            {t.eyebrow}
          </span>
          <h2 className="text-foreground text-3xl font-bold leading-[1.1] tracking-tight sm:text-4xl md:text-5xl">
            {t.title}
          </h2>
          <p className="text-muted-foreground mt-4 text-base leading-relaxed sm:text-lg">
            {t.subtitle}
          </p>
        </motion.div>

        <div ref={ref} className="grid grid-cols-1 gap-5 lg:grid-cols-2" aria-hidden="true">
          {/* Editor */}
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true, margin: '-80px' }}
            transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
            className="border-border bg-card/80 min-w-0 overflow-hidden rounded-2xl border shadow-2xl shadow-black/30"
          >
            <Chrome label="runbooks/rollback.yaml" />
            <pre className="min-h-[300px] overflow-x-auto p-4 font-mono text-[11px] leading-[1.7] sm:text-xs">
              {lines.map((l, i) => (
                <div key={i} className="flex">
                  <span className="text-muted-foreground/40 w-7 shrink-0 select-none">{i + 1}</span>
                  <span className="whitespace-pre">
                    <YamlLine text={l} />
                    {i === cursorLine && typed < totalChars && (
                      <span className="bg-primary ml-px inline-block h-[1.1em] w-[2px] translate-y-[2px] animate-pulse" />
                    )}
                  </span>
                </div>
              ))}
            </pre>
          </motion.div>

          {/* Terminal */}
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true, margin: '-80px' }}
            transition={{ duration: 0.6, delay: 0.1, ease: [0.22, 1, 0.36, 1] }}
            className="border-border relative min-w-0 overflow-hidden rounded-2xl border bg-[#07090c] shadow-2xl shadow-black/30"
          >
            <Chrome label="zsh — operari" icon={<Terminal className="h-3 w-3" />}>
              <button
                type="button"
                onClick={restart}
                aria-label={t.replay}
                title={t.replay}
                className="text-muted-foreground hover:text-foreground pointer-events-auto ml-auto rounded p-1"
              >
                <RotateCcw className="h-3.5 w-3.5" />
              </button>
            </Chrome>
            <div className="min-h-[300px] space-y-2 p-4 font-mono text-[11px] leading-relaxed sm:text-xs">
              <AnimatePresence>
                {cli >= 0 && (
                  <Line key="cmd">
                    <span className="text-primary">❯</span>{' '}
                    <span className="text-foreground/90 break-all">{t.cmd}</span>
                  </Line>
                )}
                {cli >= 1 && (
                  <Line key="plan" className="text-muted-foreground">
                    {t.plan}
                  </Line>
                )}
                {STEPS.map((s, i) => {
                  const st = stepState(i);
                  if (st === 'idle') return null;
                  const isGate = s.id === 'approve';
                  return (
                    <Line key={s.id} className="flex items-center gap-2">
                      {st === 'ok' ? (
                        <motion.span
                          initial={{ scale: 0 }}
                          animate={{ scale: 1 }}
                          transition={{ type: 'spring', stiffness: 500, damping: 20 }}
                        >
                          <Check className="h-3.5 w-3.5 text-emerald-400" />
                        </motion.span>
                      ) : (
                        <Loader2
                          className={`h-3.5 w-3.5 animate-spin ${isGate ? 'text-amber-400' : 'text-primary'}`}
                        />
                      )}
                      <span className="text-foreground/90 w-16 shrink-0">{s.id}</span>
                      <span
                        className={`truncate ${isGate && st === 'run' ? 'text-amber-300' : 'text-muted-foreground'}`}
                      >
                        {isGate
                          ? st === 'run'
                            ? t.waiting
                            : t.approved
                          : st === 'ok'
                            ? s.ms
                            : '…'}
                      </span>
                    </Line>
                  );
                })}
                {cli >= 7 && (
                  <Line key="done" className="border-border/60 mt-3 border-t pt-3 text-emerald-300">
                    ✓ {t.done}
                    <span className="text-muted-foreground block">sha256 3f9c…b2e1</span>
                  </Line>
                )}
              </AnimatePresence>
            </div>
            {/* progress bar */}
            <motion.div
              className="bg-primary absolute bottom-0 left-0 h-[2px]"
              animate={{ width: `${Math.max(0, Math.min(1, (cli + 1) / 8)) * 100}%` }}
              transition={{ duration: 0.5 }}
            />
          </motion.div>
        </div>
      </div>
    </section>
  );
}

function Chrome({
  label,
  icon,
  children,
}: {
  label: string;
  icon?: React.ReactNode;
  children?: React.ReactNode;
}) {
  return (
    <div className="border-border/70 bg-card/60 flex items-center gap-3 border-b px-4 py-2.5">
      <div className="flex gap-1.5">
        <span className="h-2.5 w-2.5 rounded-full bg-red-500/60" />
        <span className="h-2.5 w-2.5 rounded-full bg-amber-500/60" />
        <span className="h-2.5 w-2.5 rounded-full bg-emerald-500/60" />
      </div>
      <span className="text-muted-foreground flex min-w-0 items-center gap-1.5 truncate font-mono text-[11px]">
        {icon}
        {label}
      </span>
      {children}
    </div>
  );
}

function Line({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <motion.div
      initial={{ opacity: 0, x: -6 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.25 }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

function YamlLine({ text }: { text: string }) {
  const m = text.match(/^(\s*-?\s*)([\w-]+)(:?)(.*)$/);
  if (!m) return <>{text}</>;
  const [, lead, key, colon, rest] = m;
  if (!colon) return <>{text}</>;
  return (
    <Fragment>
      <span className="text-muted-foreground/70">{lead}</span>
      <span className="text-sky-300">{key}</span>
      <span className="text-muted-foreground/70">{colon}</span>
      <span className={rest.includes('"') ? 'text-amber-200' : 'text-emerald-200/90'}>{rest}</span>
    </Fragment>
  );
}
