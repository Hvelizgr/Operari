'use client';

import { AlertCircle, CheckCircle2, Loader2 } from 'lucide-react';

import type { SaveStatus } from '@/state/editorStore';

interface SaveStatusIndicatorProps {
  saveStatus: SaveStatus;
  lang: 'en' | 'es';
}

const STATUS_KEYS: Array<Exclude<SaveStatus, 'idle' | 'loading' | 'dirty'>> = [
  'saving',
  'saved',
  'error',
  'conflict',
];

export default function SaveStatusIndicator({ saveStatus, lang }: SaveStatusIndicatorProps) {
  const statusConfig: Record<
    (typeof STATUS_KEYS)[number],
    {
      icon: typeof Loader2;
      text: string;
      className: string;
      iconClassName: string;
    }
  > = {
    saving: {
      icon: Loader2,
      text: lang === 'en' ? 'Saving...' : 'Guardando...',
      className: 'text-primary/70',
      iconClassName: 'animate-spin',
    },
    saved: {
      icon: CheckCircle2,
      text: lang === 'en' ? 'Saved' : 'Guardado',
      className: 'text-green-400',
      iconClassName: '',
    },
    error: {
      icon: AlertCircle,
      text: lang === 'en' ? 'Error' : 'Error',
      className: 'text-red-400',
      iconClassName: '',
    },
    conflict: {
      icon: AlertCircle,
      text: lang === 'en' ? 'Conflict' : 'Conflicto',
      className: 'text-yellow-400',
      iconClassName: '',
    },
  };

  // The indicator only renders for transient/terminal statuses; idle,
  // loading, and dirty are intentionally invisible to keep the chrome
  // quiet during normal editing.
  if (saveStatus === 'idle' || saveStatus === 'loading' || saveStatus === 'dirty') return null;

  const config = statusConfig[saveStatus];
  const Icon = config.icon;

  return (
    <div
      className={`flex items-center gap-2 rounded-lg border border-slate-700 bg-slate-800/80 px-3 py-1.5 backdrop-blur-sm ${config.className}`}
    >
      <Icon size={14} className={config.iconClassName} />
      <span className="text-xs font-medium">{config.text}</span>
    </div>
  );
}
