'use client';

import { NodeToolbar, Position } from '@xyflow/react';
import { CircleDot, Copy, Palette, Play, Power, Trash2, Unlink } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { iconButton } from '@/components/ui/buttonVariants';
import { HoverTooltip } from '@/components/ui/Tooltip';
import { buildSnapshot, remapForPaste } from '@/lib/canvas/clipboard';
import { useEditorStore } from '@/state/editorStore';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

/**
 * Trigger a single-step execution that starts at this node. The
 * backend `/api/executions/:runbookId/run` accepts a `startNodeId`
 * which scopes the run to this step + its downstream chain. Useful
 * for debugging a specific branch without rerunning the whole
 * runbook. Mirrors chaiNNer's `useRunNode` pattern.
 */
const runFromNode = async (
  runbookId: string,
  nodeId: string,
  router: ReturnType<typeof useRouter>
): Promise<string | null> => {
  try {
    const res = await fetch(`${API_BASE}/api/executions/${runbookId}/run`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ input: {}, startNodeId: nodeId }),
    });
    if (!res.ok) return null;
    const execution = (await res.json()) as { id: string };
    const url = new URL(window.location.href);
    url.searchParams.set('run', execution.id);
    router.replace(`${url.pathname}${url.search}`);
    return execution.id;
  } catch {
    return null;
  }
};

interface NodeContextToolbarProps {
  id: string;
  /** Step nodes get full actions; frame/note get a reduced set. */
  kind: 'step' | 'frame' | 'note';
  enabled?: boolean;
  parentId?: string;
}

/**
 * Floating per-node action bar that React Flow auto-positions in screen
 * space (does not scale with zoom — labels stay readable). Visible only
 * when the node is selected. Mirrors V1's selection toolbar without
 * needing a separate selection state.
 */
export function NodeContextToolbar({
  id,
  kind,
  enabled = true,
  parentId,
}: NodeContextToolbarProps) {
  const router = useRouter();
  const [running, setRunning] = useState(false);
  // Subscribe to breakpoint membership so the toggle's pressed
  // state stays in sync. Selector returns boolean to keep
  // re-renders shallow — only flips when this id enters/leaves.
  const isBreakpoint = useEditorStore(s => s.breakpoints.includes(id));

  const runHere = async () => {
    const runbookId = useEditorStore.getState().runbookId;
    if (!runbookId) {
      useEditorStore
        .getState()
        .setStatus('error', 'Save the runbook before running a single step.');
      return;
    }
    setRunning(true);
    const ok = await runFromNode(runbookId, id, router);
    if (!ok) {
      useEditorStore.getState().setStatus('error', 'Failed to start execution.');
    }
    setRunning(false);
  };

  const duplicate = () => {
    const store = useEditorStore.getState();
    const snap = buildSnapshot([id], store.nodes, store.edges);
    const { nodes, edges } = remapForPaste(snap);
    store.appendForPaste(nodes, edges);
  };

  const remove = () => {
    useEditorStore.getState().removeNodes([id]);
  };

  const toggleEnabled = () => {
    const node = useEditorStore.getState().nodes.find(n => n.id === id);
    if (!node) return;
    useEditorStore.getState().updateNodeData(id, {
      workflow: { ...node.data.workflow, enabled: !enabled },
    });
    useEditorStore.getState().setStatus('dirty');
  };

  const detach = () => {
    useEditorStore.getState().reparentNode(id, null);
  };

  const toggleBreakpoint = () => {
    useEditorStore.getState().toggleBreakpoint(id);
  };

  const setColor = (color: string) => {
    const node = useEditorStore.getState().nodes.find(n => n.id === id);
    if (!node) return;
    useEditorStore.getState().updateNodeData(id, {
      workflow: {
        ...node.data.workflow,
        config: { ...(node.data.workflow.config ?? {}), color },
      },
    });
    useEditorStore.getState().setStatus('dirty');
  };

  // Palette mirrors n8n's sticky-note swatches but uses the Operari
  // brand tokens so a future palette tweak is a one-file edit. Order
  // matches the visual flow (warm → cool) so the picker reads as a
  // gradient strip rather than a random grid.
  const STICKY_COLORS: ReadonlyArray<{ token: string; cssVar: string; label: string }> = [
    { token: 'gold', cssVar: 'var(--op-gold)', label: 'Yellow' },
    { token: 'sunset', cssVar: 'var(--op-sunset)', label: 'Coral' },
    { token: 'moss', cssVar: 'var(--op-moss)', label: 'Green' },
    { token: 'sky', cssVar: 'var(--op-sky)', label: 'Blue' },
    { token: 'ice', cssVar: 'var(--op-ice)', label: 'Ice' },
    { token: 'stone', cssVar: 'var(--op-stone)', label: 'Gray' },
  ];

  return (
    <NodeToolbar
      isVisible={undefined /* default: visible while selected */}
      position={Position.Top}
      offset={8}
      className="bg-[color:var(--rb-node-bg)]/95 flex items-center gap-1 rounded-lg border border-[color:var(--rb-node-border)] p-1 shadow-xl backdrop-blur"
    >
      {kind === 'step' ? (
        <HoverTooltip label="Run from here">
          <button
            type="button"
            onClick={runHere}
            disabled={running}
            aria-label="Run from here"
            className={iconButton({ tone: 'primary' })}
          >
            <Play size={14} />
          </button>
        </HoverTooltip>
      ) : null}
      <HoverTooltip label="Duplicate">
        <button type="button" onClick={duplicate} aria-label="Duplicate" className={iconButton()}>
          <Copy size={14} />
        </button>
      </HoverTooltip>
      {kind === 'step' ? (
        <HoverTooltip label={enabled ? 'Disable' : 'Enable'}>
          <button
            type="button"
            onClick={toggleEnabled}
            aria-label={enabled ? 'Disable step' : 'Enable step'}
            className={iconButton({ tone: 'destructive', active: !enabled })}
          >
            <Power size={14} />
          </button>
        </HoverTooltip>
      ) : null}
      {kind === 'step' ? (
        <HoverTooltip
          label={
            isBreakpoint
              ? 'Remove breakpoint — engine will no longer pause before this step'
              : 'Set breakpoint — engine pauses before executing this step'
          }
        >
          <button
            type="button"
            onClick={toggleBreakpoint}
            aria-label={isBreakpoint ? 'Remove breakpoint' : 'Set breakpoint'}
            className={iconButton({ tone: 'destructive', active: isBreakpoint })}
          >
            <CircleDot size={14} />
          </button>
        </HoverTooltip>
      ) : null}
      {parentId ? (
        <HoverTooltip label="Detach from frame">
          <button
            type="button"
            onClick={detach}
            aria-label="Detach from frame"
            className={iconButton()}
          >
            <Unlink size={14} />
          </button>
        </HoverTooltip>
      ) : null}
      {kind === 'note' || kind === 'frame' ? (
        <>
          <div className="mx-1 h-4 w-px bg-white/10" />
          {/* Inline palette swatches. Six is the n8n count and fits the
              toolbar without overflowing on narrow zoomed-out canvases. */}
          <HoverTooltip label="Color">
            <div className="flex items-center gap-0.5 px-1" aria-label="Color">
              <Palette size={12} className="mr-0.5 text-white/50" />
              {STICKY_COLORS.map(({ token, cssVar, label }) => (
                <button
                  key={token}
                  type="button"
                  onClick={() => setColor(cssVar)}
                  aria-label={`Set color to ${label}`}
                  title={label}
                  className="h-3.5 w-3.5 rounded-full border border-white/20 transition-transform hover:scale-110"
                  style={{ background: cssVar }}
                />
              ))}
            </div>
          </HoverTooltip>
        </>
      ) : null}
      <div className="mx-1 h-4 w-px bg-white/10" />
      <HoverTooltip label="Delete">
        <button
          type="button"
          onClick={remove}
          aria-label="Delete"
          className={iconButton({ tone: 'destructive' })}
        >
          <Trash2 size={14} />
        </button>
      </HoverTooltip>
    </NodeToolbar>
  );
}
