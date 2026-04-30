'use client';

import { Panel } from '@xyflow/react';
import {
  AlertCircle,
  Bug,
  CalendarClock,
  CheckCircle2,
  Loader2,
  Moon,
  Play,
  Sparkles,
  Sun,
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

import { useTheme } from '@/context/ThemeContext';
import { useWorkflowExecution } from '@/hooks/useWorkflowExecution';
import { useEditorStore } from '@/state/editorStore';

interface ToolbarProps {
  lang: 'en' | 'es';
}

const SAVE_BADGE: Record<
  Exclude<ReturnType<typeof useEditorStore.getState>['status'], 'idle' | 'loading' | 'dirty'>,
  { en: string; es: string; tone: 'ok' | 'warn' | 'err' }
> = {
  saving: { en: 'Saving…', es: 'Guardando…', tone: 'warn' },
  saved: { en: 'Saved', es: 'Guardado', tone: 'ok' },
  error: { en: 'Save error', es: 'Error guardando', tone: 'err' },
  conflict: { en: 'Conflict — refresh', es: 'Conflicto — recargá', tone: 'err' },
};

export default function Toolbar({ lang }: ToolbarProps) {
  const router = useRouter();
  const { theme, cycleTheme } = useTheme();

  const runbookId = useEditorStore(s => s.runbookId);
  const header = useEditorStore(s => s.runbookHeader);
  const status = useEditorStore(s => s.status);
  const setRunbookHeader = useEditorStore(s => s.setRunbookHeader);
  const setStatus = useEditorStore(s => s.setStatus);

  const { executing, executeWorkflow } = useWorkflowExecution(runbookId);

  const [editingName, setEditingName] = useState(false);
  const [draftName, setDraftName] = useState(header?.name ?? '');

  useEffect(() => {
    if (!editingName) setDraftName(header?.name ?? '');
  }, [header?.name, editingName]);

  const t =
    lang === 'es'
      ? {
          run: 'Ejecutar',
          debug: 'Depurar',
          dryRun: 'Simulación',
          schedule: 'Programar',
          theme: 'Tema',
          missingId: 'Guardá el runbook antes de ejecutar.',
          launching: 'Iniciando…',
          untitled: 'Sin título',
        }
      : {
          run: 'Run',
          debug: 'Debug',
          dryRun: 'Dry run',
          schedule: 'Schedule',
          theme: 'Theme',
          missingId: 'Save the runbook before running.',
          launching: 'Launching…',
          untitled: 'Untitled',
        };

  const commitName = () => {
    const next = draftName.trim();
    if (next && next !== header?.name) {
      setRunbookHeader({ name: next });
      setStatus('dirty');
    }
    setEditingName(false);
  };

  const launch = async (mode: 'run' | 'debug' | 'dry-run') => {
    if (!runbookId) {
      setStatus('error', t.missingId);
      return;
    }
    const result = await executeWorkflow({}, mode);
    if (result?.kind === 'ok') {
      // Park the executionId on the URL so useExecutionSocket picks it
      // up and starts streaming status to the canvas.
      const url = new URL(window.location.href);
      url.searchParams.set('run', result.executionId);
      router.replace(`${url.pathname}${url.search}`);
    } else if (result?.kind === 'error') {
      setStatus('error', result.message);
    }
  };

  const ThemeIcon = theme === 'light' ? Sun : theme === 'midnight' ? Sparkles : Moon;
  const scheduled = !!header?.schedule;

  const saveBadge =
    status === 'saving' || status === 'saved' || status === 'error' || status === 'conflict'
      ? SAVE_BADGE[status]
      : null;

  return (
    <Panel
      position="top-center"
      className="bg-[color:var(--rb-node-bg)]/90 flex items-center gap-2 rounded-xl border border-[color:var(--rb-node-border)] px-3 py-2 shadow-xl backdrop-blur"
    >
      {/* Workflow name (editable) */}
      <div className="flex items-center gap-2 pr-2">
        {editingName ? (
          <input
            autoFocus
            value={draftName}
            onChange={e => setDraftName(e.target.value)}
            onBlur={commitName}
            onKeyDown={e => {
              if (e.key === 'Enter') commitName();
              if (e.key === 'Escape') setEditingName(false);
            }}
            className="w-48 rounded bg-black/30 px-2 py-1 text-sm text-[color:var(--rb-node-text)] focus:outline-none"
          />
        ) : (
          <button
            type="button"
            onClick={() => setEditingName(true)}
            className="max-w-[14rem] truncate rounded px-2 py-1 text-left text-sm font-semibold text-[color:var(--rb-node-text)] transition-colors hover:bg-white/5"
            title={header?.name ?? t.untitled}
          >
            {header?.name?.trim() || t.untitled}
          </button>
        )}
      </div>

      <div className="h-5 w-px bg-white/10" />

      {/* Run / Debug / Dry-run */}
      <button
        type="button"
        onClick={() => launch('run')}
        disabled={executing || !runbookId}
        title={t.run}
        className="flex items-center gap-1.5 rounded-md bg-[color:var(--op-moss)] px-3 py-1.5 text-sm font-semibold text-black transition-colors hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-40"
      >
        {executing ? <Loader2 size={14} className="animate-spin" /> : <Play size={14} />}
        <span>{executing ? t.launching : t.run}</span>
      </button>
      <button
        type="button"
        onClick={() => launch('debug')}
        disabled={executing || !runbookId}
        title={t.debug}
        className="flex items-center gap-1.5 rounded-md border border-white/10 px-2.5 py-1.5 text-xs font-medium text-[color:var(--rb-node-text)] transition-colors hover:bg-white/5 disabled:cursor-not-allowed disabled:opacity-40"
      >
        <Bug size={14} />
        <span>{t.debug}</span>
      </button>
      <button
        type="button"
        onClick={() => launch('dry-run')}
        disabled={executing || !runbookId}
        title={t.dryRun}
        className="flex items-center gap-1.5 rounded-md border border-white/10 px-2.5 py-1.5 text-xs font-medium text-[color:var(--rb-node-text)] transition-colors hover:bg-white/5 disabled:cursor-not-allowed disabled:opacity-40"
      >
        <Sparkles size={14} />
        <span>{t.dryRun}</span>
      </button>

      <div className="h-5 w-px bg-white/10" />

      {/* Schedule indicator */}
      <button
        type="button"
        title={scheduled ? `${t.schedule}: ${header?.schedule}` : t.schedule}
        className="relative flex h-8 w-8 items-center justify-center rounded-md border border-white/10 text-[color:var(--rb-node-muted)] transition-colors hover:bg-white/5 hover:text-[color:var(--rb-node-text)]"
      >
        <CalendarClock size={14} />
        {scheduled ? (
          <span
            className="absolute right-1 top-1 h-1.5 w-1.5 rounded-full"
            style={{ background: 'var(--op-moss)' }}
            aria-label="scheduled"
          />
        ) : null}
      </button>

      {/* Theme cycle */}
      <button
        type="button"
        onClick={cycleTheme}
        title={`${t.theme}: ${theme}`}
        className="flex h-8 w-8 items-center justify-center rounded-md border border-white/10 text-[color:var(--rb-node-muted)] transition-colors hover:bg-white/5 hover:text-[color:var(--rb-node-text)]"
      >
        <ThemeIcon size={14} />
      </button>

      {/* Save badge */}
      {saveBadge ? (
        <>
          <div className="h-5 w-px bg-white/10" />
          <div
            className={[
              'flex items-center gap-1.5 rounded-md px-2 py-1 text-xs font-medium',
              saveBadge.tone === 'ok'
                ? 'text-[color:var(--op-moss)]'
                : saveBadge.tone === 'warn'
                  ? 'text-[color:var(--op-gold)]'
                  : 'text-[color:var(--op-sunset)]',
            ].join(' ')}
          >
            {saveBadge.tone === 'ok' ? (
              <CheckCircle2 size={14} />
            ) : saveBadge.tone === 'warn' ? (
              <Loader2 size={14} className="animate-spin" />
            ) : (
              <AlertCircle size={14} />
            )}
            <span>{saveBadge[lang]}</span>
          </div>
        </>
      ) : null}
    </Panel>
  );
}
