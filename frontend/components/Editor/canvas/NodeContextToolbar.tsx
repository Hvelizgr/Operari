'use client';

import { NodeToolbar, Position } from '@xyflow/react';
import { Copy, Play, Power, Trash2, Unlink } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

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

const buttonClass =
  'flex h-7 w-7 items-center justify-center rounded transition-colors text-[color:var(--rb-node-text)] hover:bg-white/10';

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

  return (
    <NodeToolbar
      isVisible={undefined /* default: visible while selected */}
      position={Position.Top}
      offset={8}
      className="bg-[color:var(--rb-node-bg)]/95 flex items-center gap-1 rounded-lg border border-[color:var(--rb-node-border)] p-1 shadow-xl backdrop-blur"
    >
      {kind === 'step' ? (
        <button
          type="button"
          onClick={runHere}
          disabled={running}
          aria-label="Run from here"
          title="Run from here"
          className={`${buttonClass} hover:bg-[color:var(--op-moss)]/15 hover:text-[color:var(--op-moss)] disabled:cursor-not-allowed disabled:opacity-40`}
        >
          <Play size={14} />
        </button>
      ) : null}
      <button
        type="button"
        onClick={duplicate}
        aria-label="Duplicate"
        title="Duplicate"
        className={buttonClass}
      >
        <Copy size={14} />
      </button>
      {kind === 'step' ? (
        <button
          type="button"
          onClick={toggleEnabled}
          aria-label={enabled ? 'Disable step' : 'Enable step'}
          title={enabled ? 'Disable' : 'Enable'}
          className={buttonClass}
          data-active={!enabled}
        >
          <Power size={14} className={enabled ? '' : 'text-[color:var(--rb-edge-failed)]'} />
        </button>
      ) : null}
      {parentId ? (
        <button
          type="button"
          onClick={detach}
          aria-label="Detach from frame"
          title="Detach from frame"
          className={buttonClass}
        >
          <Unlink size={14} />
        </button>
      ) : null}
      <div className="mx-1 h-4 w-px bg-white/10" />
      <button
        type="button"
        onClick={remove}
        aria-label="Delete"
        title="Delete"
        className={`${buttonClass} hover:bg-[color:var(--rb-edge-failed)]/20 hover:text-[color:var(--rb-edge-failed)]`}
      >
        <Trash2 size={14} />
      </button>
    </NodeToolbar>
  );
}
