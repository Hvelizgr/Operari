'use client';

import { Panel } from '@xyflow/react';
import {
  AlertCircle,
  Bug,
  CalendarClock,
  CheckCircle2,
  FileCode,
  Loader2,
  Moon,
  Play,
  Sparkles,
  Sun,
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

import { useTheme } from '@/context/ThemeContext';
import { useWorkflowExecution, type ExecuteWorkflowResult } from '@/hooks/useWorkflowExecution';
import { rfToWorkflow } from '@/lib/canvas/adapter';
import { useEditorStore } from '@/state/editorStore';

import RunDialog, { type DialogRunResult } from '../Runbook/RunDialog';
import ScheduleDialog from '../Runbook/ScheduleDialog';
import YamlViewModal from './YamlViewModal';

interface ToolbarProps {
  lang: 'en' | 'es';
}

type Dialog = 'run' | 'debug' | 'schedule' | 'yaml' | null;

const SAVE_BADGE: Record<
  Exclude<ReturnType<typeof useEditorStore.getState>['status'], 'idle' | 'loading' | 'dirty'>,
  { en: string; es: string; tone: 'ok' | 'warn' | 'err' }
> = {
  saving: { en: 'Saving…', es: 'Guardando…', tone: 'warn' },
  saved: { en: 'Saved', es: 'Guardado', tone: 'ok' },
  error: { en: 'Save error', es: 'Error guardando', tone: 'err' },
  conflict: { en: 'Conflict — refresh', es: 'Conflicto — recargá', tone: 'err' },
};

const mapResult = (result: ExecuteWorkflowResult | undefined): DialogRunResult => {
  if (!result || result.kind === 'ok') return { status: 'ok' };
  if (result.kind === 'invalid_inputs') return { status: 'invalid_inputs', issues: result.issues };
  return { status: 'error', message: result.message };
};

export default function Toolbar({ lang }: ToolbarProps) {
  const router = useRouter();
  const { theme, cycleTheme } = useTheme();

  const runbookId = useEditorStore(s => s.runbookId);
  const header = useEditorStore(s => s.runbookHeader);
  const inputs = useEditorStore(s => s.runbookInputs);
  const nodes = useEditorStore(s => s.nodes);
  const edges = useEditorStore(s => s.edges);
  const status = useEditorStore(s => s.status);
  const setRunbookHeader = useEditorStore(s => s.setRunbookHeader);
  const setStatus = useEditorStore(s => s.setStatus);
  const hydrateFromWorkflow = useEditorStore(s => s.hydrateFromWorkflow);

  const { executing, executeWorkflow } = useWorkflowExecution(runbookId);

  const [dialog, setDialog] = useState<Dialog>(null);
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
          yaml: 'Ver YAML',
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
          yaml: 'View YAML',
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

  const handleDryRun = async () => {
    if (!runbookId) {
      setStatus('error', t.missingId);
      return;
    }
    const result = await executeWorkflow({}, 'dry-run');
    if (result?.kind === 'ok') {
      const url = new URL(window.location.href);
      url.searchParams.set('run', result.executionId);
      router.replace(`${url.pathname}${url.search}`);
    } else if (result?.kind === 'error') {
      setStatus('error', result.message);
    }
  };

  const dispatchRun = async (input: object): Promise<DialogRunResult> => {
    const mode = dialog === 'debug' ? 'debug' : 'run';
    const result = await executeWorkflow(input, mode);
    const mapped = mapResult(result);
    if (mapped.status === 'ok' && result?.kind === 'ok') {
      const url = new URL(window.location.href);
      url.searchParams.set('run', result.executionId);
      router.replace(`${url.pathname}${url.search}`);
      setDialog(null);
    }
    return mapped;
  };

  const handleScheduleChange = (next: string | null) => {
    setRunbookHeader({ schedule: next ?? undefined });
    setStatus('dirty');
  };

  const applyYaml = (next: {
    header: {
      name: string;
      slug?: string | null;
      description?: string | null;
      category?: string | null;
      schedule?: string | null;
    };
    nodes: typeof nodes extends infer T
      ? T extends Array<infer N>
        ? N extends { data: { workflow: unknown } }
          ? Array<unknown>
          : never
        : never
      : never;
    connections: unknown[];
  }) => {
    if (!runbookId) return;
    const cleanedHeader = {
      name: next.header.name,
      ...(next.header.slug ? { slug: next.header.slug } : {}),
      ...(next.header.description ? { description: next.header.description } : {}),
      ...(next.header.category ? { category: next.header.category } : {}),
      ...(next.header.schedule ? { schedule: next.header.schedule } : {}),
    };
    // YamlViewModal returns workflow-shape nodes/connections so they
    // hydrate cleanly via the existing pipeline.
    hydrateFromWorkflow(
      runbookId,
      cleanedHeader,
      inputs,
      next.nodes as never,
      next.connections as never
    );
    setStatus('dirty');
    setDialog(null);
  };

  const ThemeIcon = theme === 'light' ? Sun : theme === 'midnight' ? Sparkles : Moon;
  const scheduled = !!header?.schedule;
  const saveBadge =
    status === 'saving' || status === 'saved' || status === 'error' || status === 'conflict'
      ? SAVE_BADGE[status]
      : null;

  const workflowSnapshot = rfToWorkflow(nodes, edges);

  return (
    <>
      <Panel
        position="top-center"
        className="bg-[color:var(--rb-node-bg)]/90 flex items-center gap-2 rounded-xl border border-[color:var(--rb-node-border)] px-3 py-2 shadow-xl backdrop-blur"
      >
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

        <button
          type="button"
          onClick={() => setDialog('run')}
          disabled={executing || !runbookId}
          title={t.run}
          className="flex items-center gap-1.5 rounded-md bg-[color:var(--op-moss)] px-3 py-1.5 text-sm font-semibold text-black transition-colors hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {executing ? <Loader2 size={14} className="animate-spin" /> : <Play size={14} />}
          <span>{executing ? t.launching : t.run}</span>
        </button>
        <button
          type="button"
          onClick={() => setDialog('debug')}
          disabled={executing || !runbookId}
          title={t.debug}
          className="flex items-center gap-1.5 rounded-md border border-white/10 px-2.5 py-1.5 text-xs font-medium text-[color:var(--rb-node-text)] transition-colors hover:bg-white/5 disabled:cursor-not-allowed disabled:opacity-40"
        >
          <Bug size={14} />
          <span>{t.debug}</span>
        </button>
        <button
          type="button"
          onClick={handleDryRun}
          disabled={executing || !runbookId}
          title={t.dryRun}
          className="flex items-center gap-1.5 rounded-md border border-white/10 px-2.5 py-1.5 text-xs font-medium text-[color:var(--rb-node-text)] transition-colors hover:bg-white/5 disabled:cursor-not-allowed disabled:opacity-40"
        >
          <Sparkles size={14} />
          <span>{t.dryRun}</span>
        </button>

        <div className="h-5 w-px bg-white/10" />

        <button
          type="button"
          onClick={() => setDialog('schedule')}
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

        <button
          type="button"
          onClick={() => setDialog('yaml')}
          title={t.yaml}
          className="flex h-8 w-8 items-center justify-center rounded-md border border-white/10 text-[color:var(--rb-node-muted)] transition-colors hover:bg-white/5 hover:text-[color:var(--rb-node-text)]"
        >
          <FileCode size={14} />
        </button>

        <button
          type="button"
          onClick={cycleTheme}
          title={`${t.theme}: ${theme}`}
          className="flex h-8 w-8 items-center justify-center rounded-md border border-white/10 text-[color:var(--rb-node-muted)] transition-colors hover:bg-white/5 hover:text-[color:var(--rb-node-text)]"
        >
          <ThemeIcon size={14} />
        </button>

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

      <RunDialog
        isOpen={dialog === 'run' || dialog === 'debug'}
        onClose={() => setDialog(null)}
        onRun={dispatchRun}
        lang={lang}
        isExecuting={executing}
        mode={dialog === 'debug' ? 'debug' : 'run'}
        inputs={inputs}
      />

      <ScheduleDialog
        isOpen={dialog === 'schedule'}
        onClose={() => setDialog(null)}
        lang={lang}
        value={header?.schedule ?? null}
        onChange={handleScheduleChange}
      />

      {header ? (
        <YamlViewModal
          open={dialog === 'yaml'}
          onClose={() => setDialog(null)}
          lang={lang}
          header={{
            name: header.name,
            slug: header.slug ?? null,
            description: header.description ?? null,
            category: header.category ?? null,
            schedule: header.schedule ?? null,
          }}
          nodes={workflowSnapshot.nodes}
          connections={workflowSnapshot.connections}
          onApply={applyYaml}
        />
      ) : null}
    </>
  );
}
