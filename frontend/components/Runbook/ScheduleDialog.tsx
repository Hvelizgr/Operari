'use client';

import { Clock, X } from 'lucide-react';

import { useEscapeKey } from '@/hooks/useEscapeKey';

import CronPicker from '../Editor/CronPicker';

/**
 * Standalone dialog for the cron schedule. Wraps the existing
 * CronPicker so the same UX is available both from the editor's
 * Properties panel (where it already lived) and from a dedicated
 * TopBar button — UX-audit #18, "Schedule UI más visible".
 *
 * Intentionally not stateful — the parent owns `value` + commits the
 * change via `onChange`, same contract as CronPicker itself.
 */
export default function ScheduleDialog({
  isOpen,
  onClose,
  lang,
  value,
  onChange,
}: {
  isOpen: boolean;
  onClose: () => void;
  lang: 'en' | 'es';
  value: string | null;
  onChange: (next: string | null) => void;
}) {
  useEscapeKey(isOpen, onClose);
  if (!isOpen) return null;

  const text = {
    en: {
      title: 'Schedule this runbook',
      description:
        'Runs fire automatically on this cron. Leave off if you only want manual / webhook / API triggers.',
      done: 'Done',
    },
    es: {
      title: 'Programar este runbook',
      description:
        'Los runs se disparan automáticamente con este cron. Dejá apagado si solo querés triggers manuales / webhook / API.',
      done: 'Listo',
    },
  }[lang];

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 p-4 backdrop-blur-[2px]"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={text.title}
    >
      <div
        className="border-primary/30 bg-card w-full max-w-md rounded-xl border p-6 shadow-2xl"
        onClick={e => e.stopPropagation()}
      >
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <h2 className="text-foreground flex items-center gap-2 text-base font-bold">
              <Clock className="text-primary h-4 w-4" />
              {text.title}
            </h2>
            <p className="text-muted-foreground mt-1 text-xs leading-relaxed">{text.description}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Dismiss"
            className="text-muted-foreground hover:text-foreground shrink-0"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <CronPicker lang={lang} value={value} onChange={onChange} />

        <div className="mt-5 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="bg-primary text-primary-foreground hover:bg-primary/90 rounded-lg px-4 py-2 text-sm font-semibold"
          >
            {text.done}
          </button>
        </div>
      </div>
    </div>
  );
}
