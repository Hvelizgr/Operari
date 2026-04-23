'use client';

import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Check, Loader2 } from 'lucide-react';

const SAMPLE_YAML = `name: rollback-last-deploy
trigger: webhook.sentry
steps:
  - id: fetch_logs
    type: shell
    run: kubectl logs -n prod api -p
  - id: rollback
    type: shell
    run: helm rollback api 1
  - id: notify
    type: slack
    channel: '#incidents'
  - id: ticket
    type: linear
    project: SRE`;

const STEPS = [
  { id: 'fetch_logs', label: 'fetch service logs', dur: 900 },
  { id: 'rollback', label: 'rollback last deploy', dur: 1500 },
  { id: 'notify', label: 'post to #incidents', dur: 700 },
  { id: 'ticket', label: 'open Linear ticket', dur: 800 },
];

type StepState = 'pending' | 'running' | 'done';

/**
 * Auto-running YAML preview for the signup right panel.
 *
 * Loops through STEPS — each step transitions pending → running → done
 * and the matching YAML line lights up emerald. After all four are
 * done, a 1.5s pause, then it resets. Pure visual; no real network.
 */
export default function RunPreview({ lang }: { lang: string }) {
  const [tick, setTick] = useState(0);
  const [states, setStates] = useState<StepState[]>(STEPS.map(() => 'pending'));

  useEffect(() => {
    let cancelled = false;
    let i = 0;
    const next = () => {
      if (cancelled) return;
      if (i >= STEPS.length) {
        // Pause at "done", then reset
        setTimeout(() => {
          if (cancelled) return;
          setStates(STEPS.map(() => 'pending'));
          i = 0;
          setTick(t => t + 1);
          setTimeout(next, 600);
        }, 1500);
        return;
      }
      setStates(prev => prev.map((s, idx) => (idx === i ? 'running' : s)));
      const dur = STEPS[i].dur;
      setTimeout(() => {
        if (cancelled) return;
        setStates(prev => prev.map((s, idx) => (idx === i ? 'done' : s)));
        i += 1;
        setTimeout(next, 240);
      }, dur);
    };
    const startId = setTimeout(next, 700);
    return () => {
      cancelled = true;
      clearTimeout(startId);
    };
  }, [tick]);

  const yamlLines = SAMPLE_YAML.split('\n');

  return (
    <div className="relative">
      <div className="from-primary/15 pointer-events-none absolute -inset-8 bg-gradient-to-br via-transparent to-emerald-500/10 blur-3xl" />

      <div className="border-border bg-card/80 relative overflow-hidden rounded-2xl border shadow-2xl shadow-black/40 backdrop-blur-md">
        {/* Title bar */}
        <div className="border-border/70 bg-card/60 flex items-center gap-3 border-b px-4 py-3 sm:px-5">
          <div className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full bg-red-500/60" />
            <span className="h-2.5 w-2.5 rounded-full bg-amber-500/60" />
            <span className="h-2.5 w-2.5 rounded-full bg-emerald-500/60" />
          </div>
          <span className="text-muted-foreground font-mono text-[11px]">
            rollback-last-deploy.yaml
          </span>
          <span className="bg-primary/15 border-primary/40 text-primary ml-auto inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 font-mono text-[10px]">
            <span className="relative flex h-1.5 w-1.5">
              <span className="bg-primary absolute inline-flex h-full w-full animate-ping rounded-full opacity-75" />
              <span className="bg-primary relative inline-flex h-1.5 w-1.5 rounded-full" />
            </span>
            live
          </span>
        </div>

        {/* YAML body — each step line lights up by id */}
        <pre className="text-foreground/70 overflow-x-auto px-4 py-4 font-mono text-[11px] leading-[1.7] sm:px-5 sm:text-xs">
          {yamlLines.map((line, idx) => {
            const matched = STEPS.findIndex(s => line.includes(`id: ${s.id}`));
            const state = matched >= 0 ? states[matched] : null;
            return (
              <div
                key={idx}
                className={`block transition-colors ${
                  state === 'done' ? 'text-emerald-300' : state === 'running' ? 'text-primary' : ''
                }`}
              >
                {line || ' '}
              </div>
            );
          })}
        </pre>

        {/* Run footer — a tiny step strip that mirrors what's happening */}
        <div className="border-border/70 bg-background/40 border-t px-4 py-3 sm:px-5">
          <div className="text-muted-foreground mb-2 font-mono text-[10px] uppercase tracking-wider">
            {lang === 'es' ? 'Ejecutando' : 'Running'}
          </div>
          <ul className="space-y-1.5">
            {STEPS.map((step, i) => (
              <li key={step.id} className="flex items-center gap-2 font-mono text-[11px]">
                <StateIcon state={states[i]} />
                <span
                  className={`${
                    states[i] === 'done'
                      ? 'text-emerald-300'
                      : states[i] === 'running'
                        ? 'text-primary'
                        : 'text-muted-foreground/60'
                  }`}
                >
                  {step.label}
                </span>
              </li>
            ))}
          </ul>

          <AnimatePresence>
            {states.every(s => s === 'done') && (
              <motion.div
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="border-border/40 mt-3 border-t pt-3 font-mono text-[10px] text-emerald-300"
              >
                ✓ run completed · audit chain verified
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}

function StateIcon({ state }: { state: StepState }) {
  if (state === 'done') {
    return (
      <span className="inline-flex h-3.5 w-3.5 items-center justify-center rounded-full border border-emerald-400/60 bg-emerald-500/20">
        <Check className="h-2.5 w-2.5 text-emerald-300" />
      </span>
    );
  }
  if (state === 'running') {
    return <Loader2 className="text-primary h-3.5 w-3.5 animate-spin" />;
  }
  return (
    <span className="border-border/60 inline-flex h-3.5 w-3.5 items-center justify-center rounded-full border" />
  );
}
