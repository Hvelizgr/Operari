'use client';

import { AnimatePresence, motion } from 'framer-motion';
import { X } from 'lucide-react';

interface OnboardingStep {
  title: string;
  description: string;
  position: { x: number; y: number };
  highlight?: 'node' | 'port-output' | 'port-input' | 'canvas';
}

interface OnboardingProps {
  currentStep: number;
  steps: OnboardingStep[];
  onNext: () => void;
  onSkip: () => void;
  onClose: () => void;
  lang?: 'en' | 'es';
}

export default function Onboarding({
  currentStep,
  steps,
  onNext,
  onSkip,
  onClose,
  lang = 'en',
}: OnboardingProps) {
  if (currentStep >= steps.length) return null;

  const t =
    lang === 'es'
      ? { close: 'Cerrar tour', skip: 'Saltar tour', next: 'Siguiente', done: 'Empezar' }
      : { close: 'Close tour', skip: 'Skip Tour', next: 'Next', done: 'Get Started' };

  const step = steps[currentStep];

  return (
    <AnimatePresence>
      <motion.div
        className="pointer-events-none fixed inset-0 z-50"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
      >
        <div
          className="pointer-events-auto absolute inset-0 bg-black/40 backdrop-blur-sm"
          onClick={onClose}
        />

        <motion.div
          className="pointer-events-auto absolute"
          style={{
            left: step.position.x,
            top: step.position.y,
          }}
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.8, opacity: 0 }}
          transition={{ type: 'spring', stiffness: 300, damping: 25 }}
        >
          <div className="border-primary shadow-primary/20 max-w-sm rounded-lg border-2 bg-slate-800 p-6 shadow-2xl">
            <div className="mb-3 flex items-start justify-between">
              <div>
                <h3 className="text-lg font-semibold text-slate-100">{step.title}</h3>
                <div className="mt-1 flex items-center gap-2">
                  {steps.map((_, idx) => (
                    <div
                      key={idx}
                      className={`h-1 rounded-full transition-all duration-300 ${
                        idx === currentStep
                          ? 'bg-primary w-6'
                          : idx < currentStep
                            ? 'bg-primary/70 w-2'
                            : 'w-2 bg-slate-600'
                      }`}
                    />
                  ))}
                </div>
              </div>
              <button
                onClick={onClose}
                aria-label={t.close}
                className="text-slate-400 transition-colors hover:text-slate-200"
              >
                <X size={20} />
              </button>
            </div>

            <p className="mb-4 text-sm text-slate-300">{step.description}</p>

            <div className="flex items-center justify-between gap-3">
              <button
                onClick={onSkip}
                className="text-sm text-slate-400 transition-colors hover:text-slate-200"
              >
                {t.skip}
              </button>
              <button
                onClick={onNext}
                className="bg-primary hover:bg-primary rounded-lg px-4 py-2 text-sm font-medium text-white transition-colors"
              >
                {currentStep === steps.length - 1 ? t.done : t.next}
              </button>
            </div>
          </div>

          <svg
            className="text-primary absolute -bottom-3 left-8"
            width="24"
            height="12"
            viewBox="0 0 24 12"
          >
            <path d="M12 12L0 0h24z" fill="currentColor" />
          </svg>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

export function EmptyStateMessage({ lang }: { lang: 'en' | 'es' }) {
  const content = {
    en: {
      title: 'Welcome to the Operari canvas',
      description: 'Start building a runbook by adding steps and sequencing them.',
      cta: 'Add your first step',
    },
    es: {
      title: 'Bienvenido al canvas Operari',
      description: 'Empezá a construir un runbook agregando pasos y secuenciándolos.',
      cta: 'Agregar tu primer paso',
    },
  };

  const text = content[lang] || content['en'];

  return (
    <motion.div
      className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 text-center"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.3 }}
    >
      <div className="max-w-md rounded-xl border border-slate-700 bg-slate-800/80 p-8 backdrop-blur-sm">
        <div className="bg-primary/10 mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full">
          <svg
            className="text-primary h-8 w-8"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M13 10V3L4 14h7v7l9-11h-7z"
            />
          </svg>
        </div>
        <h2 className="mb-2 text-2xl font-bold text-slate-100">{text.title}</h2>
        <p className="mb-6 text-slate-400">{text.description}</p>
        <button className="bg-primary hover:bg-primary pointer-events-auto rounded-lg px-6 py-3 font-medium text-white transition-colors">
          {text.cta}
        </button>
      </div>
    </motion.div>
  );
}

export const ONBOARDING_STEPS_EN: OnboardingStep[] = [
  {
    title: 'Welcome to the canvas',
    description: 'This is your runbook canvas. Pan by dragging, zoom with the mouse wheel.',
    position: { x: 100, y: 100 },
    highlight: 'canvas' as const,
  },
  {
    title: 'Runbook steps',
    description:
      'Each step is one action: a shell command, an HTTP call, an approval gate, a notification.',
    position: { x: 150, y: 200 },
    highlight: 'node' as const,
  },
  {
    title: 'Output ports',
    description: 'Drag from the output port on the right to sequence the next step.',
    position: { x: 500, y: 180 },
    highlight: 'port-output' as const,
  },
  {
    title: 'Input ports',
    description: 'Drop connections on the input port (left side) to chain steps.',
    position: { x: 450, y: 280 },
    highlight: 'port-input' as const,
  },
  {
    title: 'Ready to run',
    description: 'Drag steps in, sequence them, hit Run. Logs stream live in the terminal panel.',
    position: { x: 300, y: 150 },
  },
];

export const ONBOARDING_STEPS_ES: OnboardingStep[] = [
  {
    title: 'Bienvenido al canvas',
    description:
      'Este es el canvas del runbook. Desplazate arrastrando, hacé zoom con la rueda del mouse.',
    position: { x: 100, y: 100 },
    highlight: 'canvas' as const,
  },
  {
    title: 'Pasos del runbook',
    description:
      'Cada paso es una acción: un comando shell, una llamada HTTP, un gate de aprobación, una notificación.',
    position: { x: 150, y: 200 },
    highlight: 'node' as const,
  },
  {
    title: 'Puertos de salida',
    description:
      'Arrastrá desde el puerto de salida a la derecha para secuenciar el siguiente paso.',
    position: { x: 500, y: 180 },
    highlight: 'port-output' as const,
  },
  {
    title: 'Puertos de entrada',
    description:
      'Soltá las conexiones en el puerto de entrada (lado izquierdo) para encadenar pasos.',
    position: { x: 450, y: 280 },
    highlight: 'port-input' as const,
  },
  {
    title: 'Listo para correr',
    description:
      'Arrastrá pasos, secuencialos, dale Run. Los logs aparecen en vivo en el panel de terminal.',
    position: { x: 300, y: 150 },
  },
];
