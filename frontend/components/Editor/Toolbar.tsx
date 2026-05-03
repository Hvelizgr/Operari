'use client';

import { Panel } from '@xyflow/react';
import {
  Activity,
  AlertCircle,
  Bug,
  CalendarClock,
  Camera,
  CheckCircle2,
  Download,
  FileCode,
  FileImage,
  Group,
  LayoutGrid,
  LayoutTemplate,
  Loader2,
  Moon,
  MoreHorizontal,
  Play,
  Route,
  Sparkles,
  Spline,
  Sun,
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';

import { useTheme } from '@/context/ThemeContext';
import { usePngExport } from '@/hooks/usePngExport';
import { useSnapshots } from '@/hooks/useSnapshots';
import { type ExecuteWorkflowResult, useWorkflowExecution } from '@/hooks/useWorkflowExecution';
import { rfToWorkflow } from '@/lib/canvas/adapter';
import { computeAutoLayout } from '@/lib/canvas/layout';
import { wrapInFrame } from '@/lib/canvas/wrapInFrame';
import { useEditorStore } from '@/state/editorStore';

import RunDialog, { type DialogRunResult } from '../Runbook/RunDialog';
import ScheduleDialog from '../Runbook/ScheduleDialog';
import SnapshotDialog from '../Runbook/SnapshotDialog';
import TemplateGallery, { type SelectedTemplateMeta } from '../Runbook/TemplateGallery';
import type { LineStyle } from './canvas/edgeTypes';
import YamlViewModal from './YamlViewModal';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

interface ToolbarProps {
  lang: 'en' | 'es';
  lineStyle: LineStyle;
  onLineStyleToggle: () => void;
}

interface MoreMenuItem {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
  disabled?: boolean;
}

/**
 * Overflow dropdown for secondary toolbar actions. Keeps the visible
 * toolbar focused on Run/Debug/Dry-run + Schedule and stashes the
 * less-frequent operations (YAML, exports, layout helpers, themes,
 * templates, snapshots) one click away.
 *
 * Click-outside dismiss listens on `mousedown` so the menu doesn't
 * close mid-pointer-up if the user releases outside.
 */
function MoreMenu({ label, items }: { label: string; items: MoreMenuItem[] }) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (!containerRef.current) return;
      if (containerRef.current.contains(e.target as Node)) return;
      setOpen(false);
    };
    window.addEventListener('mousedown', onDown);
    return () => window.removeEventListener('mousedown', onDown);
  }, [open]);

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        title={label}
        aria-haspopup="menu"
        aria-expanded={open}
        className="flex h-8 w-8 items-center justify-center rounded-md border border-white/10 text-[color:var(--rb-node-muted)] transition-colors hover:bg-white/5 hover:text-[color:var(--rb-node-text)]"
      >
        <MoreHorizontal size={14} />
      </button>
      {open ? (
        <ul
          role="menu"
          className="bg-[color:var(--rb-node-bg)]/95 absolute right-0 top-full z-50 mt-1 min-w-[180px] overflow-hidden rounded-lg border border-[color:var(--rb-node-border)] py-1 shadow-2xl backdrop-blur"
        >
          {items.map((item, idx) => (
            <li key={idx} role="none">
              <button
                type="button"
                role="menuitem"
                disabled={item.disabled}
                onClick={() => {
                  item.onClick();
                  setOpen(false);
                }}
                className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-xs text-[color:var(--rb-node-text)] transition-colors hover:bg-white/5 disabled:cursor-not-allowed disabled:opacity-40"
              >
                <span className="flex h-4 w-4 items-center justify-center text-[color:var(--rb-node-muted)]">
                  {item.icon}
                </span>
                <span>{item.label}</span>
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

type Dialog = 'run' | 'debug' | 'schedule' | 'yaml' | 'templates' | 'snapshots' | null;

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

export default function Toolbar({ lang, lineStyle, onLineStyleToggle }: ToolbarProps) {
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
  const reconcileFromWorkflow = useEditorStore(s => s.reconcileFromWorkflow);
  const showStats = useEditorStore(s => s.showStats);
  const setShowStats = useEditorStore(s => s.setShowStats);

  const { executing, executeWorkflow } = useWorkflowExecution(runbookId);
  const { exportImage, exporting: exportingPng } = usePngExport();

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
          png: 'Exportar PNG',
          svg: 'Exportar SVG',
          tidy: 'Auto-layout',
          wrap: 'Agrupar en frame',
          templates: 'Plantillas',
          snapshots: 'Instantáneas',
          lineStyle: lineStyle === 'smart' ? 'Aristas curvas' : 'Aristas ortogonales',
          stats: showStats ? 'Ocultar estadísticas' : 'Ver estadísticas',
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
          png: 'Export PNG',
          svg: 'Export SVG',
          tidy: 'Tidy up',
          wrap: 'Wrap in frame',
          templates: 'Templates',
          snapshots: 'Snapshots',
          lineStyle: lineStyle === 'smart' ? 'Curved edges' : 'Step edges',
          stats: showStats ? 'Hide stats' : 'Show stats',
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
      // Clear any leftover debug=1 from a prior session — Simulación
      // cards stay collapsed by default; the operator opts into the
      // inspect panel via double-click on the dry-run replay.
      url.searchParams.delete('debug');
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
      // Stamp the URL with `debug=1` so BaseStepNode auto-expands every
      // card to its inspect panel (input/output JSON, error preview).
      // Falling back to a clear when the operator dispatches a normal
      // Run from the same session keeps debug from leaking across
      // unrelated runs.
      if (mode === 'debug') url.searchParams.set('debug', '1');
      else url.searchParams.delete('debug');
      router.replace(`${url.pathname}${url.search}`);
      setDialog(null);
    }
    return mapped;
  };

  const handleScheduleChange = (next: string | null) => {
    setRunbookHeader({ schedule: next ?? undefined });
    setStatus('dirty');
  };

  const handleTidy = async () => {
    const store = useEditorStore.getState();
    const next = await computeAutoLayout(store.nodes, store.edges, { direction: 'RIGHT' });
    useEditorStore.setState({ nodes: next, status: 'dirty' });
  };

  const handleWrap = () => {
    const store = useEditorStore.getState();
    const ids = store.nodes.filter(n => n.selected).map(n => n.id);
    if (ids.length === 0) return;
    const result = wrapInFrame(ids, store.nodes, store.edges);
    if (!result) return;
    useEditorStore.setState({
      nodes: result.nodes,
      edges: result.edges,
      status: 'dirty',
    });
  };

  // Snapshot wiring: in-memory + localStorage history per runbook so
  // an operator can rewind a destructive edit without leaving the
  // canvas. Each create / restore round-trips through the workflow
  // shape, never touching the persisted YAML.
  const { snapshots, createSnapshot, restoreSnapshot, deleteSnapshot } = useSnapshots(
    runbookId ?? 'global'
  );
  const handleSnapshotCreate = () => {
    const payload = rfToWorkflow(nodes, edges);
    createSnapshot(payload.nodes, payload.connections);
  };
  const handleSnapshotRestore = (snapshotId: string) => {
    const restored = restoreSnapshot(snapshotId);
    if (!restored || !runbookId) return;
    hydrateFromWorkflow(
      runbookId,
      header ?? { name: 'Untitled' },
      inputs,
      restored.nodes,
      restored.connections
    );
    setStatus('dirty');
    setDialog(null);
  };

  // TemplateGallery hands us workflow-shape arrays via its
  // onSelectTemplate callback. Two cases:
  //
  // - Existing runbook (`?id=…`): drop the template into the current
  //   canvas via hydrateFromWorkflow — same pipeline the runbook loader
  //   uses, so frame nesting + meta keys round-trip cleanly.
  // - Blank canvas (no runbookId): create the runbook on the backend
  //   first, then redirect to /editor?id=…. Mirrors the marketing
  //   UseTemplateButton flow so both entry points behave identically.
  const handleTemplateSelect = async (
    nextNodes: unknown[],
    nextConnections: unknown[],
    meta: SelectedTemplateMeta
  ) => {
    if (runbookId) {
      hydrateFromWorkflow(
        runbookId,
        header ?? { name: 'Untitled' },
        inputs,
        nextNodes as never,
        nextConnections as never
      );
      setStatus('dirty');
      setDialog(null);
      return;
    }
    setDialog(null);
    try {
      const res = await fetch(`${API_BASE}/api/runbooks`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: meta.name,
          description: meta.description ?? `Imported from template: ${meta.slug}`,
          nodes: nextNodes,
          connections: nextConnections,
        }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const created = (await res.json()) as { id?: string };
      if (!created.id) throw new Error('create returned no id');
      router.push(`/${lang}/editor?id=${encodeURIComponent(created.id)}`);
    } catch (err) {
      setStatus(
        'error',
        err instanceof Error ? `Template apply failed: ${err.message}` : 'Template apply failed'
      );
    }
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
    // YamlViewModal returns workflow-shape nodes/connections. Use the
    // incremental reconcile path so editing a single field in the
    // YAML doesn't snap every node back to its layout origin —
    // existing nodes keep their position and selection, only the
    // changed body is refreshed.
    reconcileFromWorkflow(cleanedHeader, inputs, next.nodes as never, next.connections as never);
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
          onClick={() => setDialog('templates')}
          title={t.templates}
          className="flex items-center gap-1.5 rounded-md border border-white/10 px-2.5 py-1.5 text-xs font-medium text-[color:var(--rb-node-text)] transition-colors hover:bg-white/5"
        >
          <LayoutTemplate size={14} />
          <span>{t.templates}</span>
        </button>

        <MoreMenu
          label={lang === 'es' ? 'Más acciones' : 'More actions'}
          items={[
            {
              icon: <FileCode size={12} />,
              label: t.yaml,
              onClick: () => setDialog('yaml'),
            },
            {
              icon: exportingPng ? (
                <Loader2 size={12} className="animate-spin" />
              ) : (
                <Download size={12} />
              ),
              label: t.png,
              disabled: exportingPng,
              onClick: () => exportImage('png', `${header?.slug || header?.name || 'runbook'}.png`),
            },
            {
              icon: <FileImage size={12} />,
              label: t.svg,
              disabled: exportingPng,
              onClick: () => exportImage('svg', `${header?.slug || header?.name || 'runbook'}.svg`),
            },
            {
              icon: lineStyle === 'smart' ? <Spline size={12} /> : <Route size={12} />,
              label: t.lineStyle,
              onClick: onLineStyleToggle,
            },
            {
              icon: <LayoutGrid size={12} />,
              label: t.tidy,
              onClick: handleTidy,
            },
            {
              icon: <Group size={12} />,
              label: t.wrap,
              onClick: handleWrap,
            },
            {
              icon: <Camera size={12} />,
              label: t.snapshots,
              onClick: () => setDialog('snapshots'),
            },
            {
              icon: <Activity size={12} />,
              label: t.stats,
              onClick: () => setShowStats(!showStats),
            },
            {
              icon: <ThemeIcon size={12} />,
              label: `${t.theme}: ${theme}`,
              onClick: cycleTheme,
            },
          ]}
        />

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

      <TemplateGallery
        lang={lang}
        isOpen={dialog === 'templates'}
        onOpenChange={open => setDialog(open ? 'templates' : null)}
        onSelectTemplate={handleTemplateSelect}
      />

      <SnapshotDialog
        isOpen={dialog === 'snapshots'}
        onClose={() => setDialog(null)}
        snapshots={snapshots}
        onCreate={handleSnapshotCreate}
        onRestore={handleSnapshotRestore}
        onDelete={deleteSnapshot}
        lang={lang}
      />
    </>
  );
}
